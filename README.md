# cumsevoteaza

Private-first civic data explorer for Romanian Parliament votes, bills, parties,
and parliamentary careers.

## Workspace

```text
apps/web                  Next.js bilingual web app
packages/parliament-model Shared domain types and demo data
packages/db               Drizzle schema and database client
packages/ingest           Official-source parsers and importer CLI
docs                      Planning, progress, and source notes
```

## Local Setup

```bash
npm install
npm run dev
```

The web app defaults to Romanian at `http://localhost:3000/ro`.

For private deployments, set `CUMSEVOTEAZA_SITE_PASSWORD`. If the variable is
missing, the local app stays open for development.

## Data Principles

- Official public pages are the source of truth.
- Every import stores source URL, fetch time, content hash, parser version, and
  parse status.
- Party and parliamentary group affiliation is temporal, never a single current
  field.
- V1 stays factual: no ideological scores, endorsements, or editorial labels.
