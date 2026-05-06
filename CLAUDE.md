# CLAUDE.md

See @README.md for project overview, goals, and quickstart.

## Architectural rules

- **Adapters extend a base class** in `apps/api/src/agencies/_contract/base/` (`rest` / `graphql` / `pdf` / `scrape`). Don't implement the `AgencyAdapter` interface from scratch unless no base class fits the source's transport.
- **One agency per folder** under `apps/api/src/agencies/`. Adding an agency is a single import in `apps/api/src/app.module.ts` — there is no central registry.
- **Adapters are auto-discovered** via the `@Agency()` decorator + Nest's `DiscoveryService`. Forgetting `@Agency()` silently drops the adapter at boot.
- **Zod at every boundary** — env, REST query params, agency raw payloads. Don't trust unvalidated input.
- **Normalization helpers in `core/normalization` are pure** (no I/O, fully unit-tested). Don't add side effects there; reuse `parseVintage`, `normalizeColor`, `parseVolumeMl` from each adapter's `normalize()`.
- The canonical `NormalizedWine` shape lives in `packages/types/src/index.ts`. Every adapter targets this; don't duplicate or extend it locally.

## Database migrations

- Generate with `pnpm db:generate --name <snake_case_verb_led>` (e.g. `add_wine_grapes`, `index_wines_country`). **Always pass `--name`** — without it, drizzle-kit emits a random tag.
- Drizzle assigns numeric prefixes automatically. Never edit them.
- Workflow: edit `apps/api/src/infrastructure/database/schema.ts` → `pnpm db:generate --name ...` → review SQL → commit `schema.ts`, the generated `.sql`, and the `meta/` snapshot together → `pnpm db:migrate`.

## Debugging aggregation runs

Every `AggregatorService.runAll()` invocation writes one row per adapter to `aggregation_runs` (fetched / normalized / upserted / skipped / error). When an adapter looks broken, start with:

```sql
SELECT * FROM aggregation_runs ORDER BY started_at DESC LIMIT 20;
```

## Testing

- `pnpm test` runs Jest across all workspaces. Prefer running a single adapter's spec while iterating: `pnpm --filter @wine/api test -- la-qv`.
- Adapter specs use HTTP fixtures, not the network. Don't add tests that hit real agency endpoints.

## Working stubs

When adding a new agency, copy the matching `_examples/example-*` folder rather than starting from a blank file — the stubs are kept runnable on purpose.
