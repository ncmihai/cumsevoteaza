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

## Current Deploy Mode

- Web app deploys without a database.
- Bill and vote pages read Postgres first only when `DATABASE_URL` exists.
- Demo fallback keeps the private Vercel deployment usable before Neon is wired.
- Importer CLI remains local/manual for now; scheduled ingestion is a later
  milestone.

## Git Flow

Use `origin` for the canonical development repo and a separate deployment remote
for Vercel:

```bash
git remote add vercel https://github.com/ncmihai/cumvoteaza.git
git push vercel main
```

If Vercel is connected to `ncmihai/cumvoteaza`, every push to that repo can
trigger a deployment.
