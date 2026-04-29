# wine-agency-aggregator-quebec

A local web app that aggregates and normalizes wine inventory from
Quebec-licensed sellers — SAQ and private agencies. Each agency exposes data
differently (REST, GraphQL, PDF price-lists, plain HTML), so the backend is
built around a pluggable **agency adapter** pattern: one folder per agency, a
single common contract, all orchestrated into one canonical `Wine` shape.

> Solo, local-only project. Frontend will join this monorepo later.

## Stack

- **TypeScript** (strict) on **Node 24**
- **pnpm workspaces** + **Turborepo**
- **Biome** (lint + format)
- Backend: **NestJS**
- DB: **PostgreSQL** + **Drizzle**
- Scheduling: **`@nestjs/schedule`** (cron decorators)
- Validation: **Zod** (incl. `drizzle-zod`)
- HTTP: native `fetch` (Node 24)
- HTML scraping: `cheerio`
- PDF parsing: `pdf-parse`
- Logging: `nestjs-pino`
- Tests: Jest

## Quickstart

```bash
# from repo root
nvm use                              # node 24
pnpm install
cp .env.example .env

docker compose up -d                 # postgres on :5432
pnpm db:generate                     # create initial migration from drizzle schema
pnpm db:migrate                      # apply it

pnpm dev                             # turbo runs `nest start --watch` for apps/api
```

Then:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/agencies
curl -X POST http://localhost:3000/aggregator/run/saq
curl 'http://localhost:3000/wines?color=red&limit=10'
```

## Repo layout

```
apps/api/                            # NestJS backend
  src/
    config/                          # zod-validated env
    core/
      wine/                          # canonical entity, repo, service
      normalization/                 # pure helpers (color, vintage, price, volume, abv)
      aggregator/                    # discovers + runs all adapters
      scheduler/                     # @nestjs/schedule cron triggers
    agencies/
      _contract/                     # AgencyAdapter interface, @Agency() decorator, base classes
      _examples/                     # one stub per source-type (rest, graphql, pdf, scrape)
      saq/                           # SAQ adapter (stub fetch, working normalize)
    infrastructure/
      database/                      # drizzle client, schema, migration runner
      http/                          # fetch wrapper (timeout, retries, UA)
      pdf/                           # pdf-parse wrapper
      scraping/                      # cheerio wrapper
    api/                             # public REST: /health, /agencies, /wines
packages/
  types/                             # @wine/types — NormalizedWine + zod schemas
  tsconfig/                          # shared tsconfig presets
docker-compose.yml                   # postgres
biome.json
turbo.json
pnpm-workspace.yaml
```

## Adding a new agency

1. **Pick a template.** Copy the closest match from `apps/api/src/agencies/_examples/`:
   - `example-rest/` — JSON HTTP API
   - `example-graphql/` — GraphQL endpoint
   - `example-pdf/` — published PDF price-list
   - `example-scrape/` — HTML page
2. **Move and rename:** `cp -r _examples/example-rest agencies/foo`, then rename
   files and identifiers (`example-rest` → `foo`, `ExampleRestAdapter` → `FooAdapter`, …).
3. **Edit the adapter:** set a unique `id`, set `displayName`, define the raw
   record shape, write `fetch()` and `normalize()`. Reuse helpers from
   `core/normalization` (`parseVintage`, `normalizeColor`, etc.) — the goal is
   for `normalize()` to be terse and pure.
4. **Wire up the module:** add `FooModule` to `apps/api/src/app.module.ts`'s
   `imports` array.
5. **Restart.** The aggregator auto-discovers `@Agency()`-decorated providers
   on boot. Confirm with:
   ```bash
   curl http://localhost:3000/agencies         # foo should appear
   curl -X POST http://localhost:3000/aggregator/run/foo
   ```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API in watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Biome lint |
| `pnpm format` | Biome format (write) |
| `pnpm test` | Jest, all workspaces |
| `pnpm db:generate` | Generate a new Drizzle migration from `schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio against the local DB |

## Conventions

- **Strict TS everywhere** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Zod at every boundary** — env, REST DTOs, agency raw payloads.
- **Pure normalization functions** — easy to unit test, no I/O.
- **Fixtures over network in tests** — every adapter ships `*.fixtures.ts`.
- **One agency per folder.** Adding one is a single import in `app.module.ts`.

## Out of scope (deferred)

- Frontend (`apps/web/` will join later)
- Authentication (single-user, local)
- Job queue (BullMQ) — revisit if cron-only proves too brittle
- Playwright — add only when an agency truly requires JS rendering
- Deployment / CI
