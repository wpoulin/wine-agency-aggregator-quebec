# Wine Agency Aggregator (Quebec)

In Quebec, every legal wine sale runs through one of two channels: the **SAQ**
(the provincial public monopoly) or a **licensed private agency** (importers
authorized to curate their own portfolios under SAQ's rules). The SAQ has the
widest reach but a narrow catalog — many wines arrive as a single small lot
and disappear before most people see they existed. Private agencies fill the
gap, but each sells through its own site in its own format: REST APIs,
GraphQL endpoints, PDF price lists, plain HTML. There is no shared catalog.
Today, finding what's actually available across all legal channels means
clicking through ten different storefronts.

The goal of this project is **unified search across every regulated
wine-selling entity in Quebec** — private agencies and the SAQ. Aggregation is
the means; search is the end. Each source gets a per-source **adapter** that
fetches its catalog and normalizes the records into one canonical `Wine`
shape, and a single local API exposes the result.

> Solo, local-only project. Active development. Frontend (`apps/web/`) will
> join this monorepo later.

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

For a fresh install, set `AGGREGATOR_RUN_ON_BOOT=true` in `apps/api/.env` to
fire one full aggregation on startup; otherwise the cron triggers daily at
04:00 local.

## Querying

Once it's running:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/agencies
curl -X POST http://localhost:3000/aggregator/run            # run all agencies
curl 'http://localhost:3000/wines?color=red&limit=10'
curl 'http://localhost:3000/wines?country=Italie&q=barolo'
```

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness — returns `{ status, uptimeSec }` |
| `GET` | `/agencies` | Discovered adapters: `{ id, displayName, sourceType }[]` |
| `GET` | `/wines` | List wines. Query: `agency`, `color`, `country`, `q`, `limit` (≤500, default 50), `offset` |
| `GET` | `/wines/:id` | Single wine by id |
| `POST` | `/aggregator/run` | Run every registered adapter |
| `POST` | `/aggregator/run/:agencyId` | Run a single adapter |

## Adding an agency

Each agency lives in its own folder under `apps/api/src/agencies/`. To cover a
new source:

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

## Roadmap / Out of scope

- SAQ adapter — the obvious next source; their public catalog is the missing
  half of the "every regulated entity" goal
- Frontend (`apps/web/`) — joins later
- Authentication — single-user, local
- Job queue (BullMQ) — revisit if cron-only proves too brittle
- Playwright — add only when an agency truly requires JS rendering
- Deployment / CI

## Architecture & internals

For the stack breakdown, aggregation lifecycle, repo layout, adapter base
classes, migration workflow, and code conventions, see [CLAUDE.md](./CLAUDE.md).
