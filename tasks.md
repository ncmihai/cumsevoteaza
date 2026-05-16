# cumsevoteaza — Tasks

Operational memory for the project. Keep this file current after meaningful
implementation steps.

## Current Status

- Project repo cloned from `https://github.com/ncmihai/cumsevoteaza`.
- First milestone scaffold complete: docs, parsers, schema, UI proof, tests, build, and local browser smoke checks.
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

## Verification

- `npm run test` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed with escalation because Turbopack worker binding is sandbox-blocked.
- Browser smoke checks:
  - `/ro`
  - `/en`
  - `/ro/votes/vote-senate-l316-2025-10-27-final`
  - `/ro/members/andra-bica`

## Import Proof

- Senate bill fixture import wrote ignored local output under `data/imports/`.
- Senate vote fixture import wrote ignored local output under `data/imports/`.
- Live Senate bill import succeeded for `L316/2025` / `PL-x 429/2025`.
- Live Senate vote import succeeded with 121 nominal votes.
- Chamber nominal vote official URL was attempted and wrote a failed import snapshot for inspection.

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

- Commit the first scaffold when reviewed.
- Decide whether to wire importer persistence into Postgres next or continue broadening parser coverage first.
- Add real local Postgres setup and Drizzle migration generation.
- Expand member profile importers for current legislature rosters.
