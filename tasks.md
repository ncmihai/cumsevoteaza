# cumsevoteaza — Tasks

Operational memory for the project. Keep this file current after meaningful
implementation steps.

## Current Status

- Project repo cloned from `https://github.com/ncmihai/cumsevoteaza`.
- V2 persistence layer is locally verified: Docker Postgres, Drizzle migration, persistent Senate importers, DB-backed bill/vote pages with demo fallback.
- Deployment layer in progress for Vercel repo `https://github.com/ncmihai/cumvoteaza`.
- Scope is private-first, bilingual, data-first, and factual only.

## Active Milestone — Data Proof + First UI

- [x] Clone private GitHub repo locally.
- [x] Create split docs: planning, progress, sources.
- [x] Create monorepo workspace structure.
- [x] Add temporal parliamentary data model.
- [x] Add importer proof for Senate bill and Senate vote pages.
- [x] Add Chamber nominal vote importer attempt path.
- [x] Build bilingual app shell.
- [x] Build Transfermarkt-style member history page.
- [x] Build first vote explorer page with chamber visualization.
- [x] Install dependencies.
- [x] Run parser tests.
- [x] Run TypeScript checks.
- [x] Run production build.
- [x] Start local dev server and verify main pages.

## Active Milestone — V2 Persistence

- [x] Add Docker Compose local Postgres service.
- [x] Generate initial Drizzle migration.
- [x] Add root and web env examples for `DATABASE_URL`.
- [x] Add persistent Senate bill importer via `--persist`.
- [x] Add persistent Senate vote importer via `--persist`.
- [x] Add deterministic DB upserts for source snapshots, bills, events, documents, groups, members, memberships, votes, group totals, and nominal votes.
- [x] Switch bill and vote pages to read from Postgres first.
- [x] Keep demo fallback when `DATABASE_URL` is missing or DB is unreachable.
- [x] Run migration and persistent importer smoke test against local Postgres.

## Active Milestone — Deployment

- [x] Add Vercel build configuration at repo root.
- [x] Pin Node runtime for Vercel builds.
- [x] Add `.vercelignore` for local env, data snapshots, and build outputs.
- [x] Document Vercel settings and env vars in `docs/deployment.md`.
- [x] Add deployment Git remote for `ncmihai/cumvoteaza`.
- [x] Push deploy-ready branch to the Vercel repo.
- [ ] Connect Vercel project to `ncmihai/cumvoteaza`.
- [x] Set `CUMSEVOTEAZA_SITE_PASSWORD` in Vercel.
- [x] Add Neon `DATABASE_URL` locally and in Vercel.
- [x] Apply Drizzle migration to Neon.
- [x] Persist first Senate bill and vote proof dataset into Neon.
- [x] Verify Neon row counts and vote totals.

## Active Milestone — Real Rosters

- [x] Add shared normalized roster import shape.
- [x] Add Senate roster parser and importer.
- [x] Add Deputies roster parser and importer.
- [x] Add `senate:roster`, `deputies:roster`, and `roster:all` commands.
- [x] Add root scripts for roster import commands.
- [x] Add source snapshot traceability to mandates, committees, and roles.
- [x] Add parser fixtures for Senate and Deputies roster pages.
- [x] Add DB-backed member directory at `/[locale]/members`.
- [x] Switch member profile pages to DB-first data.
- [x] Switch party pages to DB-first data.
- [x] Verify local Docker Postgres roster import.
- [x] Apply roster migration to Neon.
- [x] Import verified rosters into Neon.
- [x] Smoke-check DB-backed member directory, member profile, and party page locally.

## Active Milestone — Chamber Vote Map

- [x] Add reusable semicircle chamber seat map for vote pages.
- [x] Encode party/group as seat color and vote choice as the seat mark.
- [x] Include absent/unknown chamber members when DB roster data is available.
- [x] Add group and vote-choice highlighting controls.
- [x] Keep nominal vote table as the audit layer below the visual map.
- [x] Verify desktop and mobile rendering locally.

## Active Milestone — 2024-Present Directories + Parliament Model

- [x] Clean early proof-import group artifacts from the 2024-present vote data.
- [x] Add `/[locale]/votes` page listing the latest 30 voted projects.
- [x] Add `/[locale]/bills` page listing the latest 30 submitted projects.
- [x] Update navigation so `Voturi` and `Proiecte` go to directory pages.
- [x] Document how the Romanian Parliament works using official sources plus Wikipedia as overview context.
- [x] Add reusable role/committee/procedure descriptions for future UI explainers.

## Active Milestone — Daily Auto-Import + 2024-Present Backfill

- [x] Add `ingestion_runs` table for cron/backfill observability.
- [x] Add `source_discoveries` table for resumable official URL discovery and checkpoints.
- [x] Add protected `/api/cron/daily-import` route.
- [x] Configure Vercel Cron to call the daily importer once per day.
- [x] Add `CRON_SECRET` env docs and examples.
- [x] Add shared sync functions used by both CLI and the cron route.
- [x] Add discovery/backfill CLI commands:
  - `ingest:discover:senate`
  - `ingest:discover:deputies`
  - `ingest:backfill:2024`
  - `ingest:sync:daily`
- [x] Add Chamber bill persistence path and Chamber nominal vote persistence path.
- [x] Make production importer output database-first instead of file-artifact-first.
- [x] Add discovery parser tests for official-style Senate and Chamber links.
- [x] Add bounded generated Senate `L<number>/<year>` discovery for backfill smoke and range runs.
- [x] Add `ingest:import:pending` command for bounded pending imports.
- [x] Add identifier normalization for Senate `B`, `BP`, `L`, compact `PLX`, and Chamber `PL-x`.
- [x] Add generated Senate discovery prefixes via `--senate-prefixes=B,BP,L,PLX`.
- [x] Add a dedicated Deputies yearly-list parser for `upl_pck2015.lista?anp=<year>` as the project backbone when the official endpoint is reachable.
- [x] Use Senate bill timelines as a complementary lifecycle/vote source by parsing dated lifecycle rows and nested Senate/Deputies vote or bill links.
- [x] Apply the new migration to Neon before deploying the cron route.
- [x] Add `CRON_SECRET` in Vercel before enabling cron in production.
- [ ] Tune Chamber seed/discovery URLs against full official 2024-present list pages before running a full backfill.
- [ ] Re-check Vercel Cron suitability after real daily sync runs; move to Render Cron if duration/reliability becomes a problem.

## Verification

- `npm run test` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed with escalation because Turbopack worker binding is sandbox-blocked.
- V2 `npm run test` — passed.
- V2 `npm run typecheck` — passed.
- V2 `npm run build` — passed.
- Local Postgres smoke test passed after Docker was started:
  - `npm run db:up` started the Postgres container.
  - `npm run db:migrate` applied the initial Drizzle migration.
  - `npm run ingest:senate:bill -- --cod=27035 --persist` persisted `bill-l316-2025`.
  - `npm run ingest:senate:vote -- --persist` persisted `vote-senate-l316-2025-10-27-final`.
  - Database row counts: 1 bill, 1 vote, 121 members, 121 nominal votes, 8 group totals, 2 source snapshots.
  - Vote totals verified: 121 present, 116 for, 0 against, 5 abstentions, 0 present-not-voting.
  - Bill events verified: one dated official event, `2025-09-04` registration at the Senate.
- Neon smoke test passed:
  - Drizzle migration applied successfully.
  - Senate bill `bill-l316-2025` persisted with 1 dated event and 28 documents.
  - Senate vote `vote-senate-l316-2025-10-27-final` persisted with 121 members, 121 nominal votes, 8 group totals, and 2 source snapshots.
  - Vote totals verified: 121 present, 116 for, 0 against, 5 abstentions, 0 present-not-voting.
- Real roster smoke test passed:
  - Senate: 134 mandates, 7 parsed current groups, 403 committee rows, 36 role rows.
  - Deputies: 330 mandates, 9 parsed current groups, 817 committee rows, 24 role rows.
  - Total members in Neon after roster import: 464.
  - Sample slugs verified in Neon: `andra-bica`, `popa-stefan-ovidiu`.
  - Local UI smoke returned `200` for `/ro/members`, `/en/members`, `/ro/members/popa-stefan-ovidiu`, and `/ro/parties/psd`.
- Browser smoke checks:
  - `/ro`
  - `/en`
  - `/ro/votes/vote-senate-l316-2025-10-27-final`
  - `/ro/members/andra-bica`
- Chamber vote map visual checks:
  - Desktop vote page renders party-colored semicircle seats with vote marks.
  - Mobile `390x844` viewport keeps controls and the chamber map inside the panel.
  - Hydration mismatch from generated seat coordinates fixed by rounding map positions.
- Directory smoke checks:
  - `/ro/votes` returned `200` and renders the latest imported voted projects list.
  - `/ro/bills` returned `200` and renders the latest imported submitted projects list.
  - `/ro/votes/vote-senate-l316-2025-10-27-final` returned `200` after artifact cleanup.
  - Cleaned vote page no longer renders `PIR` or `Fără grup`; it renders `PACE` and canonical `Neafiliați`.
- Daily auto-import checks:
  - `npm run test` passed with discovery parser coverage.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox because Turbopack worker binding is sandbox-blocked.
  - New Drizzle migration applied successfully to local Docker Postgres.
  - New Drizzle migration applied successfully to Neon.
  - Local Senate discovery smoke against the default Senate search shell completed without errors but found `0` links, so full backfill still needs tuned source-specific list seeds.
  - Neon Senate generated-discovery smoke passed for `L316/2025`: discovered `1`, imported `1`.
  - Vercel deployment URL verified: `https://cumvoteaza.vercel.app/ro`, `/ro/bills`, and `/ro/votes` return `200`.
  - Initial production Senate start run:
    - discovered generated Senate candidates `L1/2025` through `L30/2025`
    - imported a capped batch of `10`
    - current discovery statuses in Neon: 11 Senate bills imported, 64 Senate bills pending, 9 Senate votes pending, 5 Deputies votes pending, 1 Deputies vote failed.
  - Identifier discovery smoke passed in Neon for `B1-B2`, `BP1-BP2`, and `PLX1-PLX2` 2025 candidates: discovered `6`.
  - Deputies yearly-list parser tests passed against fixture-style rows.
  - Live Deputies yearly-list request from the current runtime returns `404`; importer now records a failed `deputies-yearly-list` source snapshot instead of silently treating it as empty.
  - Senate lifecycle parser tests passed; Senate bill imports now enqueue nested official vote/bill links found in dated timeline rows.
  - Pending-import smoke imported `1` queued official source with `0` partials and `0` failures.

## Import Proof

- Senate bill fixture import wrote ignored local output under `data/imports/`.
- Senate vote fixture import wrote ignored local output under `data/imports/`.
- Live Senate bill import succeeded for `L316/2025` / `PL-x 429/2025`.
- Live Senate vote import succeeded with 121 nominal votes.
- Chamber nominal vote official URL was attempted and wrote a failed import snapshot for inspection.
- Persistent import command shape:
  - `npm run ingest:senate:bill -- --cod=27035 --persist`
  - `npm run ingest:senate:vote -- --persist`

## Decision Log

- Repo: private GitHub repo is canonical.
- Stack: Next.js, TypeScript, Tailwind, local Postgres, Drizzle.
- Docs: split docs plus `tasks.md` active memory.
- Language: Romanian default, English secondary.
- Access: private deploy with env-password gate.
- Data range: `2024-2028` first.
- Ingestion: manual CLI commands first.
- Metrics: factual only in v1.
- Individual profiles: parliamentary-career history only, Transfermarkt-style dense table.

## Next Actions

- Expand member profile importers for current legislature rosters.
- Replace member and party pages with DB read models after roster import exists.
- Add source snapshot inspection pages or admin-only views.
- Redeploy Vercel after Neon env vars are saved, then smoke-check the live URL.
- Add `CRON_SECRET` to Vercel.
- Push cron/backfill implementation to the Vercel repo.
- Tune official source seeds and run a small date-slice backfill before the full 2024-present backfill.
