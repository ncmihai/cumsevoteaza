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
- Add scheduled or one-command refresh workflow for roster and vote imports.
