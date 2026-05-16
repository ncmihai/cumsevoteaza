# cumsevoteaza — Planning

## Product

`cumsevoteaza` is a private-first civic data explorer for Romanian Parliament
activity. It answers factual questions about bills, votes, parties,
parliamentary groups, and individual parliamentary careers.

The product has two core surfaces:

1. Official-data explorer for bills and votes.
2. Transfermarkt-style parliamentary history for each individual.

## Principles

- Official public pages are source of truth.
- Raw source snapshots are preserved for auditability.
- Party and group membership is temporal.
- V1 avoids political scoring, ideological labels, or editorial conclusions.
- Romanian is default; English exists from the beginning.

## Initial Scope

- Legislature: `2024-2028`.
- Chambers: Senate and Chamber of Deputies.
- Imports: manual command-line importers.
- Access: private local development, private deploy later.
- Database: local Postgres with Drizzle schema.

## First Milestone

- Import one Senate bill page.
- Import one Senate vote detail page.
- Attempt one Chamber nominal vote import from official linked source.
- Render one vote explorer.
- Render one member profile with a dense parliamentary-history table.

## Persistence Milestone

- Local development uses Docker Postgres.
- Drizzle migrations define the canonical database schema.
- Importers keep writing raw JSON/HTML snapshots for inspection and can also persist normalized records with `--persist`.
- Bill and vote pages read from Postgres first; demo data remains as a development fallback until the roster import is complete.
- Parser rules must avoid fabricating official dates. When a source event is visible but no reliable date is parsed, the importer should skip or mark the event as partial instead of inserting the runtime date.
- The first verified local persisted dataset is Senate bill `L316/2025` and its final vote on `2025-10-27`.

## Future Expansion

- Full current legislature ingestion.
- Scheduled imports.
- Search index.
- Backfill previous legislatures.
- Public-readiness pass for `cumsevoteaza.ro`.
