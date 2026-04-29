import type { Logger } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

export type AgencySourceType = 'rest' | 'graphql' | 'pdf' | 'scrape' | 'mixed';

export interface FetchContext {
  /** Per-run id, surfaced in logs and the aggregation_runs row. */
  runId: string;
  /** Scoped logger so adapter authors don't need to construct one. */
  logger: Logger;
  /** Abort signal — adapters should pass this through to fetch/setTimeout. */
  signal: AbortSignal;
}

/**
 * The single contract every agency adapter implements. Generic over the
 * agency's raw record shape so `normalize()` is type-safe per adapter.
 */
export interface AgencyAdapter<Raw = unknown> {
  /** Stable kebab-case id. Used in routes (`/aggregator/run/:id`), logs, DB rows. */
  readonly id: string;

  /** Human-readable name for UIs and logs. */
  readonly displayName: string;

  /** Transport hint surfaced for diagnostics and `/agencies` listings. */
  readonly sourceType: AgencySourceType;

  /** Pull all available raw records from the source. */
  fetch(ctx: FetchContext): Promise<Raw[]>;

  /**
   * Map one raw record to the canonical shape. Throw to skip a record with a
   * logged reason — the aggregator counts skips per run.
   */
  normalize(raw: Raw): NormalizedWine;
}
