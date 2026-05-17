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
- [x] Update Deputies yearly-list discovery to use the current official `/ords/pls/proiecte/upl_pck2015.lista?anp=<year>` URL.
- [x] Make `ingest:import:pending --years=<year>` filter pending discoveries by `discovered_on`.
- [x] Discover the official 2025 Deputies project list:
  - expected 592
  - discovered 592
- [x] Import the first bounded 2025 Deputies project batch:
  - 20 project pages imported
- [x] Verify the simplified member party/group filters on Vercel.
- [x] Run one bounded daily sync against Neon:
  - 399 discoveries
  - 3 imports
  - 0 failures
- [x] Import the next bounded 2025 Deputies project batch:
  - 10 project pages imported
  - 0 failures
- [x] Smoke-check Vercel after the latest import batch:
  - `/ro/votes`
  - `/ro/bills`
  - one member profile
  - one vote detail
  - one bill detail
- [x] Run March 2025 Deputies vote discovery:
  - 145 official links discovered
- [x] Re-run Senate `B1-B100` discovery and fix year-scoped generated Senate candidates.
- [x] Fix source discovery dedupe so deterministic discovery IDs are checked before insert.
- [x] Import a controlled Senate 2025 bill batch after the fix:
  - 5 pages imported
  - 0 failures
- [x] Add targeted pending import filters:
  - `--official-id`
  - `--source-url`
- [x] Retry and clean the old `L522/2025` Senate failure:
  - 1 page imported
  - 0 failures
  - stale error metadata cleared
- [x] Import the next bounded Senate 2025 bill batch:
  - 10 pages imported
  - 0 failures
  - Senate 2025 bill discoveries now 18 imported / 83 pending / 0 failed
- [x] Continue 2025 pending backfill checkpoint:
  - completed the first discovered Senate 2025 bill queue
  - imported pending Senate votes discovered so far
  - imported additional Deputies 2025 project batches
  - cleared related Senate bill and Deputies vote side discoveries produced by those batches
  - current 2025 status: 183 Senate bills imported, 57 Senate votes imported / 27 pending, 218 Deputies bills imported / 374 pending, 46 Deputies votes imported, 0 failed
- [x] Use Senate bill timelines as a complementary lifecycle/vote source by parsing dated lifecycle rows and nested Senate/Deputies vote or bill links.
- [x] Change source discovery dedupe to canonical official URLs plus official identifiers.
- [x] Fix member directory search so politician last-name queries work.
- [x] Reorder chamber seat allocation left-to-right by party sector.
- [x] Extract Chamber nominal vote subject metadata before broad 2025 backfill.
- [x] Add filtered pending importer support for `--chamber=deputies --kind=vote`.
- [x] Add controlled Deputies electronic-vote day discovery command.
- [x] Run a controlled Deputies vote sample before broader 2025 backfill.
- [x] Run month-scoped Deputies vote discovery for January and February 2025.
- [x] Skip unsupported joint Chamber/Senate CDEP vote pages instead of persisting them as failed Deputies votes.
- [x] Apply the new migration to Neon before deploying the cron route.
- [x] Add `CRON_SECRET` in Vercel before enabling cron in production.
- [ ] Tune Chamber seed/discovery URLs against full official 2024-present list pages before running a full backfill.
- [ ] Add a first-class joint-vote model/parser if joint Chamber/Senate sittings should be visible as their own vote type.
- [ ] Re-check Vercel Cron suitability after real daily sync runs; move to Render Cron if duration/reliability becomes a problem.

## Proposed Milestone — Public-Ready Explorer UX

- [x] Replace fixed latest-30 vote/project directories with paginated server queries.
- [x] Load the first 10 vote/project cards, then fetch more as the user scrolls or presses a load-more control.
- [x] Add loading and skeleton states for initial page load and incremental loading.
- [x] Add filters for votes and projects:
  - year
  - month
  - chamber
  - party/group sponsor where the official data supports it
  - source/status health
- [ ] Add a later factual category model for projects, starting with conservative tags such as budget, tax, justice, health, education, defense, labor, administration, environment, EU, and procedure.
- [ ] Keep categories inspectable and source-linked; do not infer ideological labels or scores in v1.
- [x] Add database indexes for directory sort/filter fields before broad 2024-present backfill becomes large.
- [x] Replace the landing page demo cards with DB-backed dynamic panels:
  - latest votes
  - latest submitted projects
  - most searched members/projects
  - most viewed pages
  - recent high-participation or close votes
  - explainers for Parliament roles, committees, and legislative stages
- [x] Add a minimal event/analytics table for private first-party usage counts, avoiding personal tracking.
- [x] Add anonymous `hot` reactions for vote and project cards/pages.
- [x] Rename visible `hot` language to neutral public-interest wording while keeping the internal reaction key compatible.
- [x] Add durable read-model tables for member legislature activity, entity search, bill vote summaries, and vote coverage.
- [x] Add `ingest:refresh-read-models` to rebuild derived data after importer batches.
- [x] Add stale-running ingestion-run cleanup before starting a new run of the same kind.
- [ ] Add automated UI tests for directory filters, pagination/load-more, loading states, and landing-page dynamic panels.
- [ ] Set `ANALYTICS_SALT` in Vercel so production can record anonymous views, searches, and hot reactions.
- [x] Apply migrations `0005` and `0006` to Neon, then run `npm run ingest:refresh-read-models`.

## Active Milestone — Historical Members + Compoziții Foundation

- [x] Pause broad `Voturi` / `Proiecte` expansion until the composition model is ready.
- [x] Add legislature/election-period filters to member, vote, and project directories.
- [x] Make member directory rows resolve mandate/group context inside the selected legislature period.
- [x] Make group/party filter options dynamic by selected legislature so historical periods show only period-relevant groups.
- [x] Add canonical `people` identity table for cross-legislature and cross-chamber person matching.
- [x] Link `members` to `people` with nullable `person_id` so existing imports remain valid.
- [x] Add government/cabinet tables for PM, ministers, and other official government roles.
- [x] Add party, group, and member governance-alignment tables with separate source/basis fields.
- [x] Add dated `composition_events` for legislature, government, coalition, group, member, committee, and role changes.
- [x] Add migration `0004_redundant_kate_bishop.sql`.
- [x] Add visible hover/focus labels to chamber seats with member name, group, and vote choice.
- [x] Fix vote chamber maps to use only mandates and groups active on the vote date.
- [x] Make the composition timeline pinned stage viewport-bounded so both chambers remain reachable while scrolling.
- [x] Compact composition timeline payloads so historical stops do not send full member/mandate records to the browser.
- [x] Apply composition migration locally.
- [x] Build first `people` backfill to create canonical person records from the current 2024-present roster.
- [x] Add first `Compoziții` read model for current legislature/chamber composition.
- [x] Add `/[locale]/compozitii` page with current Chamber/Senate seat maps and official/computed mode switch.
- [x] Apply composition migration to Neon.
- [x] Run the `people` backfill against Neon after migration.
- [x] Add `ingest:governments:skeleton` for post-1989 government timeline seeding.
- [x] Seed government skeleton locally and in Neon:
  - 27 PM/person rows
  - 35 government periods
  - 35 PM role rows
  - 69 composition events
- [x] Replace `/[locale]/compozitii` with scroll-driven timeline:
  - major event stops
  - sticky desktop stage
  - stacked mobile cards
  - manual/official verification badges
  - current composition stage when roster data exists
- [x] Change `Compoziții` timeline from cabinet-first stops to legislature-first sections with events nested inside each legislature.
- [x] Add a three-column desktop composition layout: legislature/event rail, government period panel, compact Senate/Deputies chamber maps.
- [x] Add a member profile legislature selector and period-scoped activity/votes/proposals sections.
- [x] Preserve the current route and query params when switching languages.
- [ ] Add current composition seat map that is not tied to a vote and uses alignment mode:
  - official investiture / coalition
  - computed governing support
- [ ] Add historical-roster import plan for post-1989 legislatures.
- [ ] Add member photo fields only after official source URLs are identified and stored.

## Verification

- `npm run test` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed with escalation because Turbopack worker binding is sandbox-blocked.
- 2026-05-17 public-readiness pass:
  - `npm run typecheck` passed.
  - `npm run test` passed.
  - `npm run build` passed with escalation because Turbopack worker binding is sandbox-blocked.
  - Browser smoke passed for `/ro`, `/ro/compozitii`, `/ro/votes`, `/ro/bills`, and `/ro/members/andra-bica`.
  - Locale switch preserves member route and `legislature` query params.
  - Neon read-model refresh completed:
    101 bill summaries, 68 vote coverage rows, 4087 member-legislature activity rows, 4287 search-index rows.
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
  - Bounded daily-style pass for 2025 completed with `10` imports, `1` failed CDEP nominal vote fetch, and no partials or top-level errors.
  - Same-page Senate hash-anchor discovery artifacts were marked `skipped` in Neon and the importer now ignores those links.
  - Chamber nominal vote links now canonicalize to the working `cdep.ro/ords/pls/steno` endpoint.
  - Repaired CDEP vote pass imported `6` Deputies votes into Neon with nominal row counts matching parsed totals.
  - Chamber vote persistence now batches members, derived mandates, and nominal rows so CDEP vote imports are cron-friendlier.
  - Source discovery now dedupes legacy and ORDS Chamber vote links to the same canonical official source URL.
  - Member directory search smoke passed for `/ro/members?q=bica`, returning the roster-backed `Andra Bică` result.
  - Deputies vote page smoke passed for `/ro/votes/vote-deputies-https-www-cdep-ro-ords-pls-steno-evot2015-nominal-idv-35953`; Playwright screenshot confirmed party seats now allocate left-to-right.
  - Chamber nominal vote parser smoke passed for `idv=35797`: extracted `PL-x 61/2025`, the full voted subject, 293 nominal rows, and no warnings.
  - Re-imported `idv=35797` into Neon; deployed page now shows `Vot final - PL-x 61/2025 - Adoptare` and the linked bill subject.
  - Controlled CDEP vote-day discovery sample:
    - Dates: `20251022`, `20251203`.
    - Discovered 39 official links across vote and bill pages.
    - Canonicalized CDEP nominal vote URLs so lowercase `nominal` and `idl=1` variants do not duplicate canonical `idv` URLs.
    - Imported 10 pending Deputies votes with `0` partials and `0` failures.
    - Re-imported 5 older pre-fix Deputies votes with generic `VOT ELECTRONIC` titles.
    - Neon Deputies vote quality after repair: 16 parsed, 0 partial, 0 failed, 0 generic `VOT ELECTRONIC` titles.
  - Month-scoped CDEP 2025 discovery:
    - January 2025 discovered 0 electronic-vote links.
    - February 2025 discovered 395 electronic-vote/project links.
    - First February import batch imported 15 votes and exposed 5 unsupported joint Chamber/Senate pages.
    - Unsupported joint pages are now stored as failed source snapshots and marked `skipped` in the discovery queue, without creating Deputies vote rows.
    - Cleaned previously persisted failed joint-vote rows from Neon.
    - Follow-up February batches imported 39 more Deputies votes and skipped 21 unsupported/duplicate discoveries with 0 partials and 0 failures.
    - Current Neon Deputies vote quality after the guarded batches: 64 parsed visible Deputies votes, 0 partial, 0 failed, 0 generic `VOT ELECTRONIC` titles.
    - Current Deputies vote discovery queue: 287 pending, 70 imported, 40 skipped.
- Public-ready explorer UX checks:
  - Added migration `0003_chubby_whiplash` for engagement tables and directory indexes.
  - Applied the migration to the configured database; `engagement_events` and `content_reactions` exist.
  - `/ro`, `/ro/votes?year=2025&month=12`, and `/ro/bills?q=PL-x` returned `200` locally.
  - `/api/directory/votes?limit=3&year=2025` and `/api/directory/bills?limit=3&q=PL-x` returned paginated JSON locally.
  - `/api/reactions/hot` returns a controlled disabled response until `ANALYTICS_SALT` is configured.
- Composition foundation checks:
  - Drizzle migration generated for people, governments, alignments, and composition events.
  - Vote seat map hover/focus labels added for member name, group, and vote choice.
  - Local Docker Postgres migration applied with explicit local `DATABASE_URL`.
  - Local people backfill linked 464 members to 464 people.
  - `/ro/compozitii` and `/ro/compozitii?mode=computed` returned `200` locally and rendered DB-backed chamber counts.
  - Neon migration applied successfully.
  - Neon people backfill linked 468 members to 468 people.
  - Government skeleton seed rerun locally with stable counts, confirming idempotent upserts.
  - Local `/ro/compozitii` smoke rendered 69 timeline events, Bolojan first, manual skeleton badges, and current roster seat maps.
  - Neon government skeleton seed completed with stable counts.
- Historical roster start:
  - Roster importers now accept `--legislature=2020` / `--year=2020`.
  - Deputies historical profile-ID import path added:
    `npm run ingest:deputies:roster -- --legislature=2020 --member-id-from=1 --member-id-to=450`.
  - 2020-2024 Deputies persisted to the configured database:
    354 members, 354 mandates, 430 group memberships, 1000 committee memberships.
  - 2020-2024 Senate main groups persisted from verified official group pages:
    PSD, PNL, USR, AUR, UDMR; 123 members, 123 mandates, 385 committee memberships.
  - Senate 2020 unaffiliated members are not complete yet; keep this as a source-discovery gap.
  - People backfill refreshed after historical rosters:
    613 members read, 574 people upserted, 613 members linked.
  - `Compoziții` timeline stops now build chamber compositions for the stop date when data exists, instead of only showing today's composition.
  - Seat-map hover labels now render above graph seats/center text.
  - Fixed overlap bug where open-ended 2020-2024 mandates were counted together with 2024-2028 mandates in later government periods.
  - Added 2020, 2016, 2012, and 2008 Wikipedia elected-list pages to `docs/sources.md` as validation references.
  - Fixed CDEP historical ID collision:
    2020 Deputies now use `member-deputies-2020-<idm>`, while 2024 Deputies keep `member-deputies-<idm>` for vote compatibility.
  - Cleaned and reimported Deputies rosters after the ID fix:
    2024 Deputies: 330 members; 2020 Deputies: 354 members.
  - Member pages now aggregate all chamber/source member records connected to the same `people` row.
  - `drula-catalin` verification now shows Cătălin Drulă as USR only, with 2020 and 2024 mandate history and no PSD row.
  - Extended historical Deputies imports to 2016-2020 and 2012-2016 using official CDEP profile URLs:
    2016-2020 has 361 Deputies mandates, 9 groups, 508 group memberships, and 929 committee memberships;
    2012-2016 has 417 Deputies mandates, 10 groups, 702 group memberships, and 857 committee memberships.
  - Added parser support for older parties/formations:
    ALDE, PMP, PDL, PP-DD, PC, UNPR, and PRO România.
  - Fixed historical group-to-party persistence so groups referencing old parties create the party rows before parliamentary groups are upserted.
  - Fixed duplicate member slug persistence across legislatures by suffixing duplicate member slugs with deterministic member IDs.
  - People backfill after the 2016/2012 imports:
    1723 members read, 1280 people upserted, 1723 members linked.
  - Database check after the import:
    417 Deputies mandates for `leg-2012-2016`, 361 Deputies mandates for `leg-2016-2020`, and no unscoped Deputies IDs spanning multiple legislatures.
  - Corrected USL modelling: USL is not a party row; it belongs in future
    coalition/alignment data involving PSD and PNL.
  - Added 2008-2012 and 2004-2008 legislature support and parser support for
    PD, PRM, and PUR.
  - Added coalition-text guards so USL, PSD+PC, and DA PNL-PD do not create
    party rows.
  - Extended historical Deputies imports to 2008-2012 and 2004-2008 using official CDEP profile URLs:
    2008-2012 has 339 Deputies mandates, 8 groups, 456 group memberships, and 802 committee memberships;
    2004-2008 has 378 Deputies mandates, 8 groups, 504 group memberships, and 797 committee memberships.
  - People backfill after the 2008/2004 imports:
    2440 members read, 1679 people upserted, 2440 members linked.
  - Database check after the 2008/2004 import:
    339 Deputies mandates for `leg-2008-2012`, 378 Deputies mandates for
    `leg-2004-2008`, `party-usl` absent, and no unscoped Deputies IDs spanning
    multiple legislatures.
  - Confirmed the Wikipedia Deputies/Senate index pages link legislature pages
    back to 1990; use these as discovery/sanity-check maps, not canonical data.
  - Added 2000-2004, 1996-2000, 1992-1996, and 1990-1992 legislature support.
  - Added parser support for older parties observed in official CDEP rows:
    PDSR, PSDR, FSN, FDSN, PNȚCD, PUNR, PDAR, PER, MER, PSM, PAC, and PL '93.
  - Added CDR and USD to coalition/alliance guards so they do not create party rows.
  - Hardened member slug upserts so duplicate display-name slugs retry with the deterministic member-id suffix.
  - Extended historical Deputies imports through 1990 using official CDEP profile URLs:
    2000-2004 has 393 Deputies mandates;
    1996-2000 has 367 Deputies mandates;
    1992-1996 has 381 Deputies mandates;
    1990-1992 has 448 Deputies mandates.
  - People backfill after the full Deputies historical import:
    4029 members read, 2706 people upserted, 4029 members linked.

## Import Proof

- Senate bill fixture import wrote ignored local output under `data/imports/`.
- Senate vote fixture import wrote ignored local output under `data/imports/`.
- Live Senate bill import succeeded for `L316/2025` / `PL-x 429/2025`.
- Live Senate vote import succeeded with 121 nominal votes.
- Chamber nominal vote official URL was attempted and wrote a failed import snapshot for inspection.
- Chamber nominal vote import now succeeds through the ORDS endpoint; first repaired batch persisted 6 Deputies votes.
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
- Long-term data range: post-1989, after the current-legislature composition model is proven.
- Ingestion: manual CLI commands first.
- Metrics: factual only in v1.
- Individual profiles: parliamentary-career history only, Transfermarkt-style dense table.
- Compoziții model: neutral factual composition history, with official
  investiture/coalition data stored separately from computed governing-support
  views.

## Next Actions

- Find an official, reliable source path for 2020 Senate unaffiliated members.
- Find official historical Senate roster paths for 2004-2008 through 2016-2020.
- Add coalition/alliance modelling for USL, PSD+PC, and DA PNL-PD in composition alignment data instead of `parties`.
- Add dated mandate end/replacement parsing so 2020-era compositions show exact seats-at-date, while member profiles can still show everyone who served during the term.
- Treat historical member imports as person-linked source records, not one globally stable chamber ID; CDEP `idm` can be reused by legislature.
- Smoke-check `/ro/compozitii` on Vercel after the 2020 roster deploy and confirm 2020 government stops show imported chamber data.
- Deputies are now imported from official CDEP profile pages for every legislature from 1990-present; next roster gap is historical Senate.
- Add composition alignment imports for governments/coalitions so seat maps can distinguish government support vs opposition by period.
- Expand member profile importers for earlier legislatures.
- Replace member and party pages with DB read models after roster import exists.
- Add source snapshot inspection pages or admin-only views.
- Redeploy Vercel after Neon env vars are saved, then smoke-check the live URL.
- Add `CRON_SECRET` to Vercel.
- Push cron/backfill implementation to the Vercel repo.
- Tune official source seeds and run a small date-slice backfill before the full 2024-present backfill.
- Continue 2025 backfill one bounded batch at a time:
  - import more Senate `B` candidates in small batches;
  - continue Deputies yearly project imports;
  - run month-scoped Deputies vote discovery/imports.
