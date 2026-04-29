import { Inject, Injectable } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';
import { and, eq, ilike, sql } from 'drizzle-orm';

import { DRIZZLE, type Db } from '../../infrastructure/database/database.module';
import { wines } from '../../infrastructure/database/schema';

export interface WineFilter {
  agencyId?: string;
  color?: string;
  country?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class WineRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async upsert(w: NormalizedWine): Promise<void> {
    const id = `${w.agencyId}:${w.agencySku}`;
    await this.db
      .insert(wines)
      .values({
        id,
        agencyId: w.agencyId,
        agencySku: w.agencySku,
        name: w.name,
        producer: w.producer,
        vintage: w.vintage,
        color: w.color,
        country: w.country,
        region: w.region,
        appellation: w.appellation,
        grapes: w.grapes,
        volumeMl: w.volumeMl,
        alcoholPct: w.alcoholPct?.toString() ?? null,
        priceAmount: w.price?.amount.toString() ?? null,
        priceCurrency: w.price?.currency ?? null,
        available: w.available,
        sourceUrl: w.sourceUrl,
        imageUrl: w.imageUrl,
        raw: w.raw ?? null,
      })
      .onConflictDoUpdate({
        target: [wines.agencyId, wines.agencySku],
        set: {
          name: sql`excluded.name`,
          producer: sql`excluded.producer`,
          vintage: sql`excluded.vintage`,
          color: sql`excluded.color`,
          country: sql`excluded.country`,
          region: sql`excluded.region`,
          appellation: sql`excluded.appellation`,
          grapes: sql`excluded.grapes`,
          volumeMl: sql`excluded.volume_ml`,
          alcoholPct: sql`excluded.alcohol_pct`,
          priceAmount: sql`excluded.price_amount`,
          priceCurrency: sql`excluded.price_currency`,
          available: sql`excluded.available`,
          sourceUrl: sql`excluded.source_url`,
          imageUrl: sql`excluded.image_url`,
          raw: sql`excluded.raw`,
          lastSeenAt: sql`now()`,
        },
      });
  }

  async findMany(filter: WineFilter = {}) {
    const where = and(
      filter.agencyId ? eq(wines.agencyId, filter.agencyId) : undefined,
      filter.color ? eq(wines.color, filter.color) : undefined,
      filter.country ? eq(wines.country, filter.country) : undefined,
      filter.q ? ilike(wines.name, `%${filter.q}%`) : undefined,
    );
    return this.db
      .select()
      .from(wines)
      .where(where)
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
  }

  async findById(id: string) {
    const rows = await this.db.select().from(wines).where(eq(wines.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
