import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AGENCY_METADATA } from '../../agencies/_contract/agency.decorator';
import type {
  AgencyAdapter,
  FetchContext,
} from '../../agencies/_contract/agency-adapter.interface';
import { type Db, DRIZZLE } from '../../infrastructure/database/database.module';
import { aggregationRuns } from '../../infrastructure/database/schema';
import { WineService } from '../wine/wine.service';

export interface RunReport {
  runId: string;
  agencyId: string;
  fetched: number;
  normalized: number;
  upserted: number;
  skipped: number;
  error?: string;
  durationMs: number;
}

@Injectable()
export class AggregatorService implements OnModuleInit {
  private readonly logger = new Logger(AggregatorService.name);
  private readonly adapters = new Map<string, AgencyAdapter>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly wines: WineService,
  ) {}

  onModuleInit(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      if (!wrapper.metatype || !wrapper.instance) continue;
      const isAgency = this.reflector.get<boolean>(AGENCY_METADATA, wrapper.metatype);
      if (!isAgency) continue;
      const instance = wrapper.instance as AgencyAdapter;
      if (this.adapters.has(instance.id)) {
        throw new Error(`Duplicate agency id: ${instance.id}`);
      }
      this.adapters.set(instance.id, instance);
    }
    this.logger.log(
      `Discovered ${this.adapters.size} agency adapter(s): ${[...this.adapters.keys()].join(', ') || '(none)'}`,
    );
  }

  list(): AgencyAdapter[] {
    return [...this.adapters.values()];
  }

  get(id: string): AgencyAdapter | undefined {
    return this.adapters.get(id);
  }

  async runAll(): Promise<RunReport[]> {
    const reports: RunReport[] = [];
    for (const adapter of this.adapters.values()) {
      reports.push(await this.runOne(adapter.id));
    }
    return reports;
  }

  async runOne(agencyId: string): Promise<RunReport> {
    const adapter = this.adapters.get(agencyId);
    if (!adapter) throw new Error(`Unknown agency: ${agencyId}`);

    const runId = randomUUID();
    const startedAt = Date.now();
    const ctrl = new AbortController();
    const ctx: FetchContext = {
      runId,
      logger: new Logger(`Agency:${agencyId}`),
      signal: ctrl.signal,
    };

    await this.db.insert(aggregationRuns).values({ id: runId, agencyId });

    let fetched = 0;
    let normalized = 0;
    let upserted = 0;
    let skipped = 0;
    let errorMsg: string | undefined;

    try {
      const raw = await adapter.fetch(ctx);
      fetched = raw.length;
      for (const r of raw) {
        try {
          const w = adapter.normalize(r);
          normalized++;
          await this.wines.upsert(w);
          upserted++;
        } catch (err) {
          skipped++;
          ctx.logger.warn(`skipped record: ${errToString(err)}`);
        }
      }
    } catch (err) {
      errorMsg = errToString(err);
      this.logger.error(`Agency ${agencyId} run failed: ${errorMsg}`);
    } finally {
      await this.db
        .update(aggregationRuns)
        .set({
          finishedAt: sql`now()`,
          fetched,
          normalized,
          upserted,
          skipped,
          error: errorMsg ?? null,
        })
        .where(eq(aggregationRuns.id, runId));
    }

    return {
      runId,
      agencyId,
      fetched,
      normalized,
      upserted,
      skipped,
      ...(errorMsg !== undefined && { error: errorMsg }),
      durationMs: Date.now() - startedAt,
    };
  }
}

function errToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
