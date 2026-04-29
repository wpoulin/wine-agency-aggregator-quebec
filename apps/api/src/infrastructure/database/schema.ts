import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Canonical wine table. Each row represents one normalized listing from one
 * agency. (agency_id, agency_sku) is the natural key — the same physical wine
 * may appear across multiple agencies and is intentionally represented as
 * separate rows. De-duplication, if any, happens in a view/query layer.
 */
export const wines = pgTable(
  'wines',
  {
    id: text('id').primaryKey(), // `${agency_id}:${agency_sku}`
    agencyId: text('agency_id').notNull(),
    agencySku: text('agency_sku').notNull(),
    name: text('name').notNull(),
    producer: text('producer'),
    vintage: integer('vintage'),
    color: text('color').notNull(),
    country: text('country'),
    region: text('region'),
    appellation: text('appellation'),
    grapes: jsonb('grapes').$type<string[]>().notNull().default([]),
    volumeMl: integer('volume_ml'),
    alcoholPct: numeric('alcohol_pct', { precision: 4, scale: 2 }),
    priceAmount: numeric('price_amount', { precision: 10, scale: 2 }),
    priceCurrency: text('price_currency'),
    available: boolean('available').notNull().default(true),
    sourceUrl: text('source_url'),
    imageUrl: text('image_url'),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agencySkuUnique: uniqueIndex('wines_agency_sku_unique').on(t.agencyId, t.agencySku),
    colorIdx: index('wines_color_idx').on(t.color),
    countryIdx: index('wines_country_idx').on(t.country),
    nameIdx: index('wines_name_idx').on(t.name),
  }),
);

/**
 * Per-run audit log. One row per (agency, run) so we can see how each
 * aggregator pass went without spelunking through pino logs.
 */
export const aggregationRuns = pgTable(
  'aggregation_runs',
  {
    id: text('id').notNull(),
    agencyId: text('agency_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    fetched: integer('fetched').notNull().default(0),
    normalized: integer('normalized').notNull().default(0),
    upserted: integer('upserted').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    error: text('error'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.agencyId] }),
    agencyIdx: index('aggregation_runs_agency_idx').on(t.agencyId),
  }),
);
