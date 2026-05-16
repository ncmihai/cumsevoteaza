# cumsevoteaza — Progress Log

Append-only implementation history.

## 2026-05-16 — Kickoff Implementation

- Cloned private repo `https://github.com/ncmihai/cumsevoteaza`.
- Confirmed repo started with only `README.md`.
- Started monorepo scaffold with docs, packages, importer proof, and Next app.
- Product direction locked:
  - data-first official-source explorer
  - Transfermarkt-style parliamentary career profiles
  - bilingual RO/EN
  - private-first access model
  - factual-only v1

## 2026-05-16 — First Milestone Scaffold

- Added root workspace config, `.gitignore`, `.env.example`, and `package-lock.json`.
- Added split project memory:
  - `tasks.md`
  - `docs/planning.md`
  - `docs/progress.md`
  - `docs/sources.md`
- Added `packages/parliament-model` with temporal domain types and a demo dataset for `L316/2025`.
- Added `packages/db` with Drizzle schema for members, temporal affiliations, bills, votes, source snapshots, and vote totals.
- Added `packages/ingest` with:
  - Senate bill parser
  - Senate vote detail parser
  - generic Chamber nominal vote attempt parser
  - importer CLI
  - parser fixtures and tests
- Added `apps/web` with:
  - Next.js 16 App Router
  - Tailwind v4
  - `next-intl` request config
  - private deploy gate via `CUMSEVOTEAZA_SITE_PASSWORD`
  - bilingual `/ro` and `/en` entry pages
  - vote explorer page
  - bill page
  - party page
  - Transfermarkt-style member history page
- Ran importer proof:
  - Senate bill fixture succeeded.
  - Senate vote fixture succeeded.
  - Live Senate bill import succeeded for `L316/2025` and `PL-x 429/2025`.
  - Live Senate vote import succeeded with 121 nominal votes and official totals `116/0/5/0`.
  - Chamber official URL attempt failed gracefully and wrote an ignored failure snapshot.
- Tightened Senate bill identifier extraction after the first live parse picked up an example `L123/2025` from the search form help text.
- Verification:
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed when run outside sandbox.
  - Browser smoke checks passed for homepage, English page, vote page, and member page.

## 2026-05-16 — V2 Persistence Layer

- Added local Postgres Docker Compose service.
- Generated initial Drizzle migration under `packages/db/drizzle/`.
- Added `.env.example` and `apps/web/.env.example` guidance for `DATABASE_URL`.
- Added `createDbSession()` so CLI importers can close Postgres connections cleanly.
- Added persistent Senate import paths:
  - `npm run ingest:senate:bill -- --cod=27035 --persist`
  - `npm run ingest:senate:vote -- --persist`
- Added deterministic upserts for source snapshots, bills, events, sponsors, documents, groups, members, derived mandates, group memberships, votes, group vote totals, and individual votes.
- Updated vote and bill pages to query Postgres first and fall back to demo data when no database is configured or reachable.
- Verification:
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside sandbox.
- Initial local Postgres smoke test was blocked until Docker was started.

## 2026-05-16 — Local Postgres Smoke Verified

- Started the local Docker Postgres service with `npm run db:up`.
- Applied the initial Drizzle migration with `npm run db:migrate`.
- Persisted the corrected Senate bill import for `L316/2025`:
  - 1 bill
  - 1 dated bill event
  - 28 documents
  - 1 source snapshot
- Persisted the Senate vote detail import:
  - 1 vote
  - 121 members
  - 121 nominal votes
  - 8 group totals
  - 1 source snapshot
- Verified official vote totals in Postgres:
  - 121 present
  - 116 for
  - 0 against
  - 5 abstentions
  - 0 present-not-voting
- Tightened Senate bill parsing so missing event dates are not replaced with the current date.
- Confirmed local Next routes return `200` for DB-backed vote and bill pages.

## 2026-05-16 — Deployment Prep

- Added root `vercel.json` for monorepo deployment:
  - install with `npm ci`
  - build with `npm run build`
  - output from `apps/web/.next`
- Pinned Vercel/Node runtime through root `package.json` engines.
- Added `.vercelignore` so local env files, data snapshots, and build outputs are not uploaded.
- Added `docs/deployment.md` with Vercel project settings, env vars, and the deployment repo target `ncmihai/cumvoteaza`.
- Added a local Git remote named `vercel` pointing at `https://github.com/ncmihai/cumvoteaza.git`.
- Pushed deploy-ready `main` to `ncmihai/cumvoteaza` at commit `9566e5d`.

## 2026-05-16 — Neon Database Connected

- Added the Neon `DATABASE_URL` only to ignored local env files.
- Confirmed tracked env example files do not contain the real database URL or private password.
- Applied the Drizzle schema migration to Neon.
- Persisted the first official-source proof dataset into Neon:
  - Senate bill `bill-l316-2025`
  - Senate vote `vote-senate-l316-2025-10-27-final`
  - 121 members
  - 121 nominal votes
  - 8 group totals
  - 2 source snapshots
- Verified hosted vote totals: 121 present, 116 for, 0 against, 5 abstentions, 0 present-not-voting.

## 2026-05-16 — Real Roster Milestone

- Added a shared normalized roster import shape for both chambers.
- Added Senate roster ingestion from official group and profile pages.
- Added Deputies roster ingestion from current `structura2015` group and profile pages.
- Added `senate:roster`, `deputies:roster`, and `roster:all` importer commands with bounded profile-fetch concurrency.
- Added source snapshot traceability to member mandates, committee memberships, and roles.
- Added fixtures and parser tests for Senate and Deputies index, group, and profile pages.
- Added DB-backed `/[locale]/members` directory with chamber and group filters.
- Switched member profile and party pages to DB-first read models with demo fallback.
- Added a narrow curl fallback for official-source fetches when Node rejects the Chamber certificate chain.
- Verified local Docker Postgres roster import:
  - 134 Senate mandates
  - 330 Deputies mandates
  - 464 total members
  - 403 Senate committee rows
  - 817 Deputies committee rows
  - 36 Senate role rows
  - 24 Deputies role rows
- Applied the roster migration to Neon and imported the verified roster dataset.
- Verified Neon sample slugs `andra-bica` and `popa-stefan-ovidiu`.
- Browser-smoked local DB-backed member directory, real member profile, and party page.

## 2026-05-16 — Chamber Vote Map

- Replaced the simple vote-colored grid on vote detail pages with a semicircle chamber map.
- Seats now use parliamentary group color as the base layer and a vote mark for `for`, `against`, `abstention`, `present_not_voting`, `absent`, and `unknown`.
- DB-backed vote pages now materialize missing chamber members from roster mandates/group memberships as absent seats when no nominal vote row exists.
- Added group and vote-choice highlight controls while keeping the nominal vote table as the audit layer.
- Verified the map visually on desktop and a `390x844` mobile viewport.
- Fixed a local hydration mismatch by rounding generated seat coordinates before rendering.
