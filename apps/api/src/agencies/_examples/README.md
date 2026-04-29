# Agency Examples

Templates for the four common data-source shapes. Each subfolder is a
self-contained adapter you can copy into `agencies/<your-agency>/`. They are
**not registered** in `app.module.ts` — copy and wire up your own.

| Folder | Source type | Base class |
|---|---|---|
| `example-rest/` | JSON HTTP API | `RestAdapterBase` |
| `example-graphql/` | GraphQL endpoint | `GraphqlAdapterBase` |
| `example-pdf/` | Published price-list PDF | `PdfAdapterBase` |
| `example-scrape/` | HTML page | `ScrapeAdapterBase` |

## Adding a new agency

1. Copy the folder closest to your data source (e.g. `example-rest/` → `agencies/foo/`).
2. Rename files and identifiers (`example-rest` → `foo`, `ExampleRestAdapter` → `FooAdapter`, etc.).
3. Edit `id`, `displayName`, the raw record shape, `fetch()`, and `normalize()`.
4. Add `FooModule` to `app.module.ts`'s `imports`.
5. Restart — the adapter shows up at `GET /agencies` and is runnable at `POST /aggregator/run/foo`.

That's it — no registry to edit, no DI tokens to plumb. The `@Agency()`
decorator on the class is what makes `AggregatorService` discover it on boot.
