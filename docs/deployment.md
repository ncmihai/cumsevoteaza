# cumsevoteaza — Deployment

## Target

Deployment-facing GitHub repo: `https://github.com/ncmihai/cumvoteaza`

The product remains named `cumsevoteaza` in the UI and codebase. The deploy repo
can be named differently without changing package names or routes.

## Vercel Project Settings

Use the monorepo root as the Vercel project root.

- Framework Preset: `Next.js`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `apps/web/.next`
- Node.js: pinned by root `package.json` to `22.x`

The root `vercel.json` records the build settings so the dashboard should need
minimal manual configuration.

## Required Environment Variables

For private preview/deploy access:

```text
CUMSEVOTEAZA_SITE_PASSWORD=<choose-a-private-password>
```

For DB-backed pages later:

```text
DATABASE_URL=<pooled-postgres-connection-string>
```

If `DATABASE_URL` is missing, the app deploys with bundled demo data. When Neon
is added, use the pooled connection string for serverless deployments.

For the daily Vercel Cron importer:

```text
CRON_SECRET=<private-random-token>
```

The cron route is `/api/cron/daily-import`. Vercel Cron calls it once per day
from `vercel.json`; the route rejects requests unless the `Authorization`
header is `Bearer ${CRON_SECRET}`.

Use a generated secret, not the site password. A 32+ character random value is
enough; for example, generate one locally with `openssl rand -base64 32` and
store that value only in Vercel/local env.

## Current Deploy Mode

- Web app deploys with Neon through `DATABASE_URL`.
- Bill and vote directory pages read Postgres first and fall back to demo data
  only when the database is unavailable.
- Vercel Cron is configured for daily incremental imports.
- Historical 2024-present backfill remains a manual CLI workflow because it can
  run longer than a serverless request should.

## Import Commands

```bash
npm run ingest:discover:senate -- --years=2024,2025,2026
npm run ingest:discover:deputies -- --years=2024,2025,2026
npm run ingest:backfill:2024 -- --max-imports=100
npm run ingest:sync:daily -- --max-imports=30
```

Use the backfill command locally or from a longer-running worker first. Use the
daily sync command for the same bounded workflow that Vercel Cron calls.

For Senate backfill, the official search form can be seeded with a bounded
number range:

```bash
npm run ingest:discover:senate -- --years=2025 --senate-from=1 --senate-to=700
```

Start with a narrow range, verify imports, then widen it.

## Git Flow

Use `origin` for the canonical development repo and a separate deployment remote
for Vercel:

```bash
git remote add vercel https://github.com/ncmihai/cumvoteaza.git
git push vercel main
```

If Vercel is connected to `ncmihai/cumvoteaza`, every push to that repo can
trigger a deployment.
