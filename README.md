# wine-agency-aggregator-quebec

A local web app that aggregates and normalizes wine inventory from
Quebec-licensed sellers — SAQ and private agencies. Each agency exposes data
differently (REST, GraphQL, PDF price-lists, plain HTML), so the backend is
built around a pluggable **agency adapter** pattern: one folder per agency, a
single common contract, all orchestrated into one canonical `Wine` shape.

> Solo, local-only project. Active development. Frontend (`apps/web/`) will
> join this monorepo later.

## Stack

**Runtime**
- **TypeScript** (strict) on **Node 24**
- **pnpm workspaces** + **Turborepo**

**Backend**
- **NestJS** with `@nestjs/schedule` (cron decorators)
- HTTP: native `fetch` (Node 24)
- HTML scraping: `cheerio` · PDF parsing: `pdf-parse`
- Logging: `nestjs-pino`

**Data**
- **PostgreSQL** + **Drizzle** (`drizzle-zod` for inferred schemas)
- Validation: **Zod** (env, REST query, agency raw payloads)

**Tooling**
- **Biome** (lint + format)
- **Jest** (unit tests with fixtures)

## Quickstart

```bash
# from repo root
nvm use                              # node 24
pnpm install
cp .env.example .env                 # postgres credentials (root)
cp apps/api/.env.example apps/api/.env

docker compose up -d                 # postgres on :5432
pnpm db:migrate                      # apply migrations

pnpm dev                             # turbo runs `nest start --watch` for apps/api
```

Verify it's alive:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/agencies
curl -X POST http://localhost:3000/aggregator/run            # run all agencies
curl 'http://localhost:3000/wines?color=red&limit=10'
```

For a fresh install, set `AGGREGATOR_RUN_ON_BOOT=true` in `apps/api/.env` to
fire one full aggregation on startup; otherwise the cron triggers daily at
04:00 local.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness — returns `{ status, uptimeSec }` |
| `GET` | `/agencies` | Discovered adapters: `{ id, displayName, sourceType }[]` |
| `GET` | `/wines` | List wines. Query: `agency`, `color`, `country`, `q`, `limit` (≤500, default 50), `offset` |
| `GET` | `/wines/:id` | Single wine by id |
| `POST` | `/aggregator/run` | Run every registered adapter |
| `POST` | `/aggregator/run/:agencyId` | Run a single adapter |

## How it works

```
@nestjs/schedule (cron)  ──▶  AggregatorService.runAll()
       │                              │
       │                              ▼
       │                      for each adapter:
       │                        ┌───────────────────────────┐
       │                        │ adapter.fetch()           │
       │                        │ adapter.normalize(raw[])  │ → NormalizedWine[]
       │                        │ WineRepository.upsertAll  │
       │                        └───────────────────────────┘
       └──▶ insert row in `aggregation_runs` (fetched / normalized / upserted / skipped / error)
```

- Adapters are **auto-discovered** at boot via the `@Agency()` decorator and
  Nest's `DiscoveryService` — no central registry to maintain.
- Each adapter extends one of four base classes in
  `apps/api/src/agencies/_contract/base/` (`rest`, `graphql`, `pdf`, `scrape`),
  which handle the boring parts (timeouts, retries, error capture, run timing).
- The canonical `NormalizedWine` shape lives in
  `packages/types/src/index.ts` — the single contract every adapter targets.
- Every aggregation run writes a row to `aggregation_runs` so you can inspect
  history (`SELECT * FROM aggregation_runs ORDER BY started_at DESC`).

## Repo layout

```
apps/api/                              # NestJS backend
  src/
    config/                            # zod-validated env (env.schema.ts)
    core/
      wine/                            # canonical entity, repo, service
      normalization/                   # pure helpers (color, vintage, price, volume, abv)
      aggregator/                      # discovers + runs all adapters; exposes /aggregator/run
      scheduler/                       # @nestjs/schedule cron registration
    agencies/
      _contract/
        agency-adapter.interface.ts    # the AgencyAdapter contract
        agency.decorator.ts            # @Agency() — marks a provider as an adapter
        base/
          rest-adapter.base.ts         # extend for JSON HTTP APIs
          graphql-adapter.base.ts      # extend for GraphQL endpoints
          pdf-adapter.base.ts          # extend for PDF price-lists
          scrape-adapter.base.ts       # extend for HTML pages
      _examples/                       # one runnable stub per source-type
        example-rest/  example-graphql/  example-pdf/  example-scrape/
      la-qv/                           # real adapter
    infrastructure/
      database/                        # drizzle client, schema, migration runner
      http/                            # fetch wrapper (timeout, retries, UA)
      pdf/                             # pdf-parse wrapper
      scraping/                        # cheerio wrapper
    api/                               # public REST: /health, /agencies, /wines
  drizzle/migrations/                  # generated SQL + meta/ (committed)

packages/
  types/                               # @wine/types — NormalizedWine + zod schemas
  tsconfig/                            # shared tsconfig presets

docker-compose.yml                     # postgres
biome.json  turbo.json  pnpm-workspace.yaml
```

## Adding a new agency

1. **Pick the matching base class** in `apps/api/src/agencies/_contract/base/`
   (`rest`, `graphql`, `pdf`, or `scrape`). Look at the corresponding
   `_examples/example-*` folder for a working stub.
2. **Copy and rename:** `cp -r _examples/example-rest agencies/foo`, then
   rename files and identifiers (`example-rest` → `foo`,
   `ExampleRestAdapter` → `FooAdapter`, …).
3. **Edit the adapter:** set a unique `id`, set `displayName`, define the raw
   record shape, implement `fetch()` and `normalize()`. Reuse helpers from
   `core/normalization` (`parseVintage`, `normalizeColor`, etc.) so
   `normalize()` stays terse and pure.
4. **Wire up the module:** add `FooModule` to `apps/api/src/app.module.ts`'s
   `imports` array.
5. **Verify.** Restart `pnpm dev`, then:
   ```bash
   curl http://localhost:3000/agencies                       # foo should appear
   curl -X POST http://localhost:3000/aggregator/run/foo     # trigger one run
   curl 'http://localhost:3000/wines?agency=foo&limit=5'
   ```

## Database migrations

Drizzle generates SQL migrations from `apps/api/src/infrastructure/database/schema.ts`
into `apps/api/drizzle/migrations/`. Both the `.sql` files and the `meta/`
folder (`_journal.json` + per-migration snapshots) are committed — they are
the source of truth for diff generation and apply order.

```bash
pnpm db:generate --name <description>   # e.g. add_wine_tasting_notes
pnpm db:migrate                          # apply pending migrations
pnpm db:studio                           # browse the DB
```

Always pass `--name` with a short, snake_case, verb-led description (`init`,
`add_wine_grapes`, `index_wines_country`). Without it, drizzle-kit emits a
random tag. Drizzle assigns the numeric prefix automatically — never edit it.

Workflow: edit `schema.ts` → `pnpm db:generate --name ...` → review the
generated SQL → commit schema, SQL, and `meta/` together → `pnpm db:migrate`.

## Configuration

Two env files:

- **`/.env`** — postgres credentials consumed by `docker-compose.yml`.
- **`apps/api/.env`** — application config (loaded by NestJS via `dotenv`).

Application env (`apps/api/.env`), validated by `src/config/env.schema.ts`:

| Var | Default | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | — | **yes** | Postgres connection string |
| `PORT` | `3000` | no | HTTP port |
| `NODE_ENV` | `development` | no | `development` · `test` · `production` |
| `LOG_LEVEL` | `info` | no | pino level (`fatal`…`trace`) |
| `AGGREGATOR_CRON` | `0 4 * * *` | no | Cron expression for the scheduled run |
| `AGGREGATOR_RUN_ON_BOOT` | `false` | no | Fire one full run at startup |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API in watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm format` / `pnpm format:check` | Biome format |
| `pnpm check` | Biome check (lint + format) |
| `pnpm test` | Jest, all workspaces |
| `pnpm db:generate` | Generate a new Drizzle migration from `schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio against the local DB |

## Conventions

- **Strict TS everywhere** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Zod at every boundary** — env, REST query, agency raw payloads.
- **Pure normalization** — `core/normalization` helpers do no I/O, are unit-tested.
- **Adapters extend a base class** — never implement `AgencyAdapter` from scratch unless a source-type doesn't fit `rest` / `graphql` / `pdf` / `scrape`.
- **One agency per folder** — adding one is a single import in `app.module.ts`.

## Roadmap / Out of scope

- Frontend (`apps/web/`) — joins later
- Authentication — single-user, local
- Job queue (BullMQ) — revisit if cron-only proves too brittle
- Playwright — add only when an agency truly requires JS rendering
- Deployment / CI
