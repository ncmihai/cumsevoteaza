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

## 2026-05-16 — 2024-Present Directories And Parliament Model

- Added `/[locale]/votes` as a DB-first directory for the latest 30 imported voted projects.
- Added `/[locale]/bills` as a DB-first directory for the latest 30 imported submitted projects.
- Updated top navigation so `Voturi` and `Proiecte` open the directory pages instead of a single proof item.
- Cleaned early Senate proof-import group artifacts in the live database:
  - remapped `group-senate-pir` references to `group-senate-pace`
  - remapped old `fara-grup`/`neafiliati` references to `group-senate-unaffiliated`
  - merged duplicated unaffiliated group vote totals
  - deleted unreferenced old group rows
- Updated the Senate vote parser so future imports map 2024-present `PIR`/`PACE` style labels to canonical `PACE` and old no-group labels to canonical unaffiliated.
- Added `docs/parliament-how-it-works.md` with a factual working model of chambers, legislative flow, committees, groups, roles, plenary votes, and product copy rules.
- Smoke-checked `/ro/votes`, `/ro/bills`, and the cleaned Senate vote page locally.

## 2026-05-16 — Daily Auto-Import And Backfill Infrastructure

- Added Drizzle schema support for `ingestion_runs` and `source_discoveries`.
- Generated migration `0002_tiresome_chronomancer.sql`.
- Added a protected Next.js route at `/api/cron/daily-import`.
- Configured Vercel Cron to call the route once per day.
- Added `CRON_SECRET` to env examples and deployment documentation.
- Added reusable ingest sync functions for:
  - Senate source discovery
  - Deputies source discovery
  - pending discovery imports
  - bounded daily sync
  - staged 2024-present backfill
- Added root and ingest package commands:
  - `ingest:discover:senate`
  - `ingest:discover:deputies`
  - `ingest:backfill:2024`
  - `ingest:sync:daily`
- Added a Deputies bill parser/persistence path and a Chamber nominal vote persistence path.
- Added discovery parser tests for official-style Senate and Chamber links.
- Verified:
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox.
  - The migration applied to local Docker Postgres.
  - The migration applied to Neon.
- Local Senate discovery against the default Senate list/search page found no exposed result links, so full historical scraping still needs tuned official list seeds before the first real backfill run.

## 2026-05-16 — Senate Generated Discovery Smoke

- Added bounded generated Senate discovery using official
  `Lista.aspx?an_cls=<year>&nr_cls=L<number>` search URLs.
- Added `ingest:import:pending` for controlled import batches after discovery.
- Verified against Neon with a one-row smoke:
  - `npm run ingest:discover:senate -- --years=2025 --discovery-limit=0 --senate-from=316 --senate-to=316`
  - `npm run ingest:import:pending -- --max-imports=1`
  - Result: discovered `1`, imported `1`.

## 2026-05-16 — Production Deploy And First Start

- Verified Vercel deployment at `https://cumvoteaza.vercel.app`.
- Smoke-checked deployed routes:
  - `/ro`
  - `/ro/bills`
  - `/ro/votes`
- Started the first controlled production data run against Neon:
  - discovered generated Senate candidates `L1/2025` through `L30/2025`
  - imported a capped batch of `10`
- Discovery status after the start run:
  - 11 Senate bills imported
  - 64 Senate bills pending
  - 9 Senate votes pending
  - 5 Deputies votes pending
  - 1 Deputies vote failed

## 2026-05-16 — Identifier-Aware Discovery

- Added official identifier normalization for:
  - Senate `B<number>/<year>`
  - Senate `BP<number>/<year>`
  - Senate `L<number>/<year>`
  - compact Senate-side `PLX<number>/<year>`
  - Chamber `PL-x <number>/<year>`
- Updated Senate and Deputies bill parsers to store aliases in `bill.identifiers`.
- Updated discovery to classify Senate generated/search URLs for `B`, `BP`, `L`, and `PLX`.
- Added `--senate-prefixes=B,BP,L,PLX` for controlled generated Senate discovery.
- Verified a tiny Neon smoke for 2025 `B1-B2`, `BP1-BP2`, and `PLX1-PLX2`: discovered `6`.

## 2026-05-16 — Deputies Yearly Backbone Parser

- Added a dedicated parser for the official Deputies yearly project list
  `upl_pck2015.lista?anp=<year>`.
- Parser records the official expected count when present and extracts
  `upl_pck2015.proiect?idp=<id>` project detail links as `source_discoveries`.
- Added fixture-style tests for the yearly list parser.
- Live request from the current runtime to the CDEP yearly list returns `404`;
  importer now stores this as a failed `deputies-yearly-list` source snapshot so
  the issue is inspectable instead of being mistaken for an empty year.

## 2026-05-16 — Senate As Complementary Lifecycle Source

- Updated Senate bill parsing to read dated lifecycle rows instead of relying
  only on broad page text.
- Senate timeline rows now create factual bill events with the visible date,
  chamber signal, and source URL.
- Senate bill imports now enqueue nested official links found in those timeline
  rows:
  - Senate vote details from `VoturiPlenDetaliu.aspx`.
  - Chamber nominal vote links from `cdep.ro/pls/steno/evot2015`.
  - Chamber bill links from `upl_pck2015.proiect`.
- Added parser tests for mixed Senate and Deputies timeline/vote links.
- Verified:
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox.
  - `npm run ingest:import:pending -- --max-imports=1` imported `1` queued
    source with no partials or failures.
