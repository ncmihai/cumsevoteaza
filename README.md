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
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
npm run db:up
npm run db:migrate
npm run dev
```

The web app defaults to Romanian at `http://localhost:3000/ro`.

For private deployments, set `CUMSEVOTEAZA_SITE_PASSWORD`. If the variable is
missing, the local app stays open for development.

## Import Data

With local Postgres running:

```bash
npm run ingest:senate:bill -- --cod=27035 --persist
npm run ingest:senate:vote -- --persist
```

The app reads from Postgres when `DATABASE_URL` is set and falls back to the
bundled demo dataset when it is not.

## Deploy

This repo can deploy to Vercel from the monorepo root. The build settings are
encoded in `vercel.json`:

```bash
npm ci
npm run build
```

Required Vercel environment variable for private access:

```text
CUMSEVOTEAZA_SITE_PASSWORD
```

Optional until Neon is connected:

```text
DATABASE_URL
```

Without `DATABASE_URL`, deployed pages use the bundled demo dataset. See
`docs/deployment.md` for the deployment repo and dashboard settings.

## Data Principles

- Official public pages are the source of truth.
- Every import stores source URL, fetch time, content hash, parser version, and
  parse status.
- Party and parliamentary group affiliation is temporal, never a single current
  field.
- V1 stays factual: no ideological scores, endorsements, or editorial labels.
