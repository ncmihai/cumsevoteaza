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
- Added visible hover/focus seat labels so every chamber-map circle can expose
  the member name, group, and vote choice before a future photo layer exists.

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

## 2026-05-16 — Composition History Foundation

- Put broad vote/project backfill expansion on hold to prioritize historical
  member and composition modeling.
- Added a canonical `people` table and a nullable `members.person_id` link so
  the same person can be connected across multiple source-specific member
  records, legislatures, chambers, and government roles.
- Added government/composition schema foundations:
  - `governments`
  - `government_roles`
  - `government_party_alignments`
  - `government_group_alignments`
  - `member_governance_alignments`
  - `composition_events`
- Added neutral alignment enums for official investiture/coalition views and
  computed governing-support views, without ideological or editorial scoring.
- Generated Drizzle migration `0004_redundant_kate_bishop.sql`.
- Added `ingest:people:backfill`, an idempotent command that creates canonical
  people rows from existing member records and links `members.person_id`.
- Applied the migration to local Docker Postgres with an explicit local
  `DATABASE_URL` override because the root `.env` points to Neon.
- Ran the local people backfill:
  - 464 members read
  - 464 people upserted
  - 464 members linked
- Applied the same migration to Neon and ran the people backfill there:
  - 468 members read
  - 468 people upserted
  - 468 members linked
- Added DB-first `/[locale]/compozitii` with:
  - current Chamber of Deputies and Senate seat maps
  - group breakdown panels
  - member hover/focus labels on every seat
  - official investiture vs computed voting-support mode switch
- Verified `/ro/compozitii` and `/ro/compozitii?mode=computed` locally against
  Docker Postgres.

## 2026-05-20 — CDEP History Probe

- Added `tools/cdep-history-probe`, a file-first Python crawler for official
  CDEP member history pages.
- Added root script `npm run probe:cdep-history` with two commands:
  - `roster-urls` to generate the post-1989 CDEP roster URL matrix.
  - `crawl` to fetch roster/profile pages, save raw snapshots, parse profile
    records, and follow official `Activitate parlamentară` career links.
- Kept generated probe output ignored under `data/cdep-history/`.
- Verified a known multi-legislature profile seed:
  - fetched 4 unique profiles from one seed
  - found 24 official career-link edges
  - captured official profile photos and period-specific party logos
- Verified a bounded 2004 Deputies roster probe:
  - fetched active and `par=X` roster pages
  - discovered official profile links
  - fetched 3 profile pages as a small smoke test
- Ran the clean 2004 base batch for both chambers without career expansion:
  - 541 official profiles fetched
  - 378 Deputies profiles
  - 163 Senate profiles
  - 71 replacement relations
- Added `audit` command for parsed CDEP history output:
  - summarizes parsed JSONL
  - reports missing data and duplicate names
  - optionally compares legislature/chamber counts against Postgres via `psql`
- Extended audit comparison to fall back to the repo's Node Postgres driver when
  local `psql` is unavailable.
- Ran the 2004 audit against Neon:
  - Deputies: probe 378, Postgres 378
  - Senate: probe 163, Postgres 167
  - The Senate difference is in existing Wikipedia-derived data; the CDEP probe
    shows cleaner official names and exposes the dirty `?` row in Postgres.
- Added `preview-import`, a file-only normalization step that creates person
  candidates from CDEP career-link graph edges and lists missing career profile
  keys for later expansion.

## 2026-05-16 — Compoziții Timeline Scroll Story

- Added a curated post-1989 government skeleton seed command:
  `npm run ingest:governments:skeleton`.
- Seed data currently stores:
  - 27 PM/person rows
  - 35 government periods
  - 35 Prime Minister role rows
  - 69 composition events
- Skeleton rows use `manual_curation` and render as `skeleton manual` until
  official-source snapshots are attached later.
- Replaced the simple `Compoziții` page with a scroll-driven timeline:
  - desktop left rail with major events
  - sticky desktop visual stage
  - mobile stacked cards
  - official/computed mode switch
  - honest empty state when historical parliamentary rosters are not imported
  - current roster seat maps when the active government includes the current
    imported composition
- Added `CompositionTimeline` as the client-side scroll activation layer using
  `IntersectionObserver` and CSS transitions, without scroll hijacking or a
  heavy animation dependency.
- Added government skeleton tests for unique deterministic IDs, current-first
  ordering, and manual-curation basis.
- Verification:
  - `npm run typecheck` passed.
  - `npm run test` passed.
  - `npm run build` passed.
  - Local seed was rerun with stable counts.
  - Neon seed completed with the same counts.
  - Local `/ro/compozitii` rendered 69 events with Bolojan first and manual
    skeleton badges visible.
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

## 2026-05-16 — Bounded Import Pass After Senate Lifecycle Update

- Ran a bounded daily-style pass against Neon:
  - `npm run ingest:sync:daily -- --years=2025 --max-imports=10 --discovery-limit=1`
  - Result: `10` imported, `1` failed, `0` partial, `0` skipped, no top-level
    errors.
- The pass confirmed Senate lifecycle discovery can feed real vote work:
  - Imported one Senate vote detail discovered from a bill timeline.
- The failed item was a Chamber nominal vote fetch from
  `cdep.ro/pls/steno/evot2015.Nominal`; this matches the already documented
  CDEP fetch instability.
- Found and fixed a generic discovery issue where same-page Senate bill anchors
  such as `#profile` were being treated as separate bill discoveries.
- Marked existing same-page Senate hash-anchor discoveries in Neon as `skipped`
  so they no longer count as imported bill sources.
- Verified after the fix:
  - Focused ingest parser/discovery tests passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox.

## 2026-05-16 — Chamber Nominal Vote Repair

- Confirmed the current Chamber electronic vote pages work under
  `https://www.cdep.ro/ords/pls/steno/evot2015.Nominal?idv=<id>`.
- Added canonicalization for legacy `cdep.ro/pls/steno/evot2015.*` links so
  discovery and imports use the ORDS endpoint.
- Updated the Chamber nominal parser to read only real nominal rows:
  - numeric row index;
  - official member profile link with `idm`;
  - group label;
  - vote value.
- Chamber vote member IDs now use official Deputies IDs, for example
  `member-deputies-3`, so imported votes join to roster-backed profiles.
- Added parser coverage for `DA`, `NU`, `AB`, and `-` vote values.
- Batched Chamber vote persistence for members, derived mandates, and nominal
  rows to avoid one SQL statement per deputy per vote.
- Updated existing CDEP vote discoveries in Neon from legacy `/pls/steno` URLs
  to `/ords/pls/steno` URLs and reset failed rows to pending.
- Imported the repaired CDEP vote batch into Neon:
  - 6 Deputies vote discoveries imported.
  - Each imported vote has nominal row counts matching parsed totals.
- Verification:
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox.

## 2026-05-16 — Dedupe, Search, And Seat Ordering

- Changed official source discovery dedupe to canonicalize URLs before identity
  checks, including legacy Chamber `/pls/steno` vote links to the working ORDS
  endpoint.
- Discovery now also dedupes by official source identifier when available, so
  re-runs update the existing row instead of creating duplicate work.
- Fixed member directory search:
  - the homepage search submits to `/[locale]/members`;
  - the directory accepts `q`;
  - matching covers display name, first name, last name, group, and party, with
    Romanian diacritics normalized.
- Reordered chamber seat slots so grouped party seats progress left-to-right
  across the semicircle instead of filling each arc row from bottom to top.
- Verification:
  - `/ro/members?q=bica` returned the roster-backed `Andra Bică` result.
  - The Deputies vote page for `idv=35953` rendered the updated seat map in a
    Playwright screenshot.
  - `npm run test` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed outside the sandbox.

## 2026-05-16 — Chamber Vote Subject Metadata

- Investigated deployed vote `idv=35797`, which showed a generic Chamber vote
  title without the voted subject.
- Confirmed the official CDEP nominal vote page itself contains the needed
  `Subiect vot` block, including:
  - `PL-x 61/2025`;
  - the linked Chamber project page;
  - the full subject text;
  - nominal rows and official totals.
- Updated the Chamber nominal vote parser to extract that subject block and
  attach imported Chamber votes to a placeholder bill when the real bill detail
  has not been imported yet.
- Chamber nominal vote imports now record a parser warning and partial snapshot
  when nominal rows exist but no subject metadata is found.
- Added `--persist` support to the `chamber:vote` CLI command for targeted
  one-vote repair imports.
- Re-imported `idv=35797` into Neon:
  - vote title: `Vot final - PL-x 61/2025 - Adoptare`;
  - bill id: `bill-pl-x-61-2025`;
  - nominal rows: 293;
  - warnings: none.
- Deployed page smoke confirmed the vote now shows the `PL-x 61/2025` title and
  the health-law subject from the official source.

## 2026-05-16 — Controlled Deputies Vote Sample

- Added `discover:deputies-votes` / `ingest:discover:deputies-votes` for CDEP
  electronic-vote day pages.
- Added filtered pending imports, so validation runs can import only a scoped
  queue such as `--chamber=deputies --kind=vote`.
- Ran a controlled CDEP vote-day discovery sample against Neon:
  - dates: `20251022`, `20251203`;
  - discovered 39 official links across nominal vote pages and bill pages;
  - after canonical cleanup: 23 pending Deputies vote discoveries, 6 already
    imported, 14 stale duplicate variants skipped.
- Fixed CDEP vote canonicalization before importing:
  - lowercase `evot2015.nominal` now normalizes to `evot2015.Nominal`;
  - `idl` language params are removed from nominal vote identity;
  - vote discoveries use `idv` as the official id, not the row's `PL-x`
    identifier.
- Imported a capped sample of 10 pending Deputies votes:
  - imported: 10;
  - partial: 0;
  - failed: 0.
- Re-imported 5 older Deputies votes that had been imported before subject
  parsing existed.
- Final Neon quality check after the sample:
  - Deputies votes in DB: 16 parsed;
  - partial Deputies vote snapshots: 0;
  - failed Deputies vote snapshots: 0;
  - remaining generic `VOT ELECTRONIC` vote titles: 0.

Next broader backfill should use the CDEP vote-day calendar by month, then
import in batches with the same `--chamber=deputies --kind=vote` filter and
inspect partial/failed counts after each batch.

## 2026-05-16 — CDEP Month-Scoped Vote Backfill Guard

- Ran CDEP 2025 electronic-vote discovery by month before widening the backfill:
  - January 2025 found 0 vote days/links.
  - February 2025 discovered 395 official vote/project links.
- Imported February discoveries in capped batches against Neon.
- First February batch imported 15 Deputies votes and exposed 5 joint Chamber/Senate vote pages that use a mixed `Parlamentar` column instead of Deputies-only nominal rows.
- Added a guard in the Chamber nominal vote parser:
  - detect joint Chamber/Senate vote pages
  - store the raw source snapshot as failed/inspectable
  - mark the discovery as `skipped`
  - do not create a Deputies-only vote row for a joint sitting
- Cleaned the previously persisted failed joint-vote rows from Neon.
- Ran guarded follow-up batches:
  - 19 additional Deputies votes imported cleanly
  - 21 unsupported joint/duplicate discoveries skipped
  - 0 partial imports
  - 0 failed imports
- Current Neon quality after the guarded pass:
  - 64 visible Deputies vote rows, all backed by parsed source snapshots
  - 0 generic `VOT ELECTRONIC` vote titles
  - 0 failed or partial visible Deputies vote rows
  - discovery queue: 287 pending, 70 imported, 40 skipped

Next broader backfill should continue February pending discoveries in capped
batches until the queue is clean, then move to March 2025 discovery.

## 2026-05-16 — Public-Ready Explorer UX

- Replaced the fixed latest-30 vote and project directory pages with paginated explorers.
- Added SQL-level directory pagination and filters for year, month, chamber, source status, text search, and group/sponsor group where supported.
- Added API endpoints for paginated vote and project directory data.
- Added load-more behavior with an automatic scroll trigger and skeleton loading rows.
- Added anonymous first-party engagement infrastructure:
  - `engagement_events` for page views and searches
  - `content_reactions` for idempotent `hot` reactions
  - `ANALYTICS_SALT` for hashing anonymous visitor cookies before storage
- Replaced homepage demo cards with DB-backed panels for latest votes, latest projects, most viewed, member searches, trending votes, and trending projects.
- Added factual explainer panels for committees and parliamentary groups.
- Added hot buttons to vote/project directory cards and vote/project detail pages.
- Generated and applied migration `0003_chubby_whiplash` to the configured database.
- Verified:
  - `npm run typecheck` passed
  - `npm run test` passed
  - `npm run build` passed
  - local `/ro`, `/ro/votes?year=2025&month=12`, `/ro/bills?q=PL-x`, and directory APIs returned successful responses
  - `hot` API returns a controlled disabled response until `ANALYTICS_SALT` is configured

## 2026-05-16 — Historical Roster Start: 2020-2024

- Made roster parsing legislature-aware so 2020-2024 mandates do not overwrite 2024-2028 mandates.
- Added historical Deputies profile-ID backfill support:
  - `npm run ingest:deputies:roster -- --legislature=2020 --member-id-from=1 --member-id-to=450`
  - Direct official profile pages expose mandate, group, party, and committee history even when a historical group index is unreliable.
- Fixed CDEP profile name parsing: the parser now prefers the official page title over generic section headings like `Activitate publică`.
- Added deterministic member slug collision handling in persistence. When two different chamber records share a name, the second slug gets a member-id suffix instead of failing the import.
- Added a scoped TLS fallback for official pages with an incomplete certificate chain; the importer retries with certificate verification disabled only after the normal fetch fails on certificate validation.
- Imported 2020-2024 Deputies into the configured database:
  - 354 members
  - 354 mandates
  - 430 group memberships
  - 1000 committee memberships
- Imported 2020-2024 Senate main parliamentary groups from verified official group URLs:
  - PSD, PNL, USR, AUR, UDMR
  - 123 members
  - 123 mandates
  - 385 committee memberships
  - unaffiliated Senate members still need a separate official discovery path.
- Refreshed person linkage after the historical import:
  - 613 members read
  - 574 people upserted
  - 613 members linked
- Updated `Compoziții` timeline data so each stop can render the composition for that stop's own date when historical roster data exists.
- Fixed chamber/vote seat-map hover labels by raising hovered seats and tooltips above the graph center and neighboring seats.

Verification:
- `npm run typecheck` passed after persistence/TLS adjustments.
- `npm run test` passed after persistence/TLS adjustments.
- `npm run build` passed after the timeline/importer changes.
- Database verification for `leg-2020-2024` returned 354 Deputies mandates and 123 Senate mandates.

## 2026-05-16 — Composition Overlap Fix

- Fixed impossible chamber counts on later government periods after importing 2020 rosters.
- Root cause: many historical mandates have no explicit `endsOn`, so 2020-2024 mandates were treated as still active during 2024-2028 governments.
- Composition seat maps now bound open-ended mandates by their legislature end date.
- DB verification after the fix:
  - Bolojan / Ciolacu II period: 331 Deputies and 133-134 Senators, not 2020+2024 stacked totals.
  - 2020-period stops still need finer temporal exits/replacements before they can be treated as exact chamber-at-day counts.
- Added Wikipedia elected-list pages for 2020, 2016, 2012, and 2008 as validation/reference material, not official source-of-truth imports.

## 2026-05-16 — Deputies Historical ID Collision Repair

- Investigated `drula-catalin` showing both USR and PSD.
- Root cause: CDEP `idm` values are reused across legislatures. `idm=93` is
  Cătălin Drulă in 2020, but a different PSD deputy in 2024, while the importer
  had used `member-deputies-<idm>` as if it were globally stable.
- Fixed Deputies roster IDs:
  - current 2024 records keep `member-deputies-<idm>` to stay compatible with
    imported nominal vote rows;
  - historical records use `member-deputies-<legislature-start-year>-<idm>`,
    starting with `member-deputies-2020-<idm>`.
- Cleaned contaminated 2020 Deputies rows from the configured DB:
  - removed unscoped 2020 Deputies mandates and related history rows;
  - removed 22 orphaned bad member rows.
- Reimported 2024 Deputies roster:
  - 330 members
  - 330 mandates
  - official group counts: PSD 93, AUR 62, PNL 53, USR 40, UDMR 21, Minorități 17, UPR 16, SOS RO 15, Neafiliați 13.
- Reimported 2020 Deputies roster with scoped IDs:
  - 354 members
  - 354 mandates
  - 430 group memberships
  - 1000 committee memberships.
- Refreshed people linkage:
  - 945 members read
  - 772 people upserted
  - 945 members linked.
- Made member profile pages person-aware: a slug can now show all source-member
  records connected to the same `people` row, which is the correct foundation
  for the Transfermarkt-style parliamentary history.
- Fixed party history row chamber display so party rows inherit the chamber from
  the relevant mandate instead of defaulting to Senate.
- Verification:
  - `drula-catalin` now resolves to Cătălin Drulă, current group USR, current party USR, with 2020 and 2024 USR history rows and no PSD row.
  - No unscoped Deputies member ID now spans multiple legislatures.
  - `npm run typecheck`, `npm run test`, and `npm run build` passed.

## 2026-05-16 — Deputies Historical Rosters: 2016-2020 and 2012-2016

- Extended the roster legislature catalog with 2016-2020 and 2012-2016.
- Expanded the party catalog and party parser for older formations that appear
  in historical CDEP profiles/groups:
  - ALDE
  - PMP
  - PDL
  - PP-DD
  - PC
  - UNPR
  - PRO România
- Fixed a historical import dependency issue where a parsed group could
  reference an older `partyId` that was not included in the normalized party
  payload. The CLI now adds parties inferred from groups before persistence.
- Fixed bulk member persistence for repeated politician names across
  legislatures. Duplicate member slugs now get deterministic member-id suffixes
  instead of failing the import.
- Imported 2016-2020 Deputies from official CDEP profile pages:
  - 361 members
  - 361 mandates
  - 9 groups
  - 8 parties
  - 508 group memberships
  - 301 party affiliations
  - 929 committee memberships
- Imported 2012-2016 Deputies from official CDEP profile pages:
  - 417 members
  - 417 mandates
  - 10 groups
  - 9 parties
  - 702 group memberships
  - 489 party affiliations
  - 857 committee memberships
- Refreshed people linkage after the new historical imports:
  - 1723 members read
  - 1280 people upserted
  - 1723 members linked
- Database verification:
  - `leg-2012-2016` Deputies mandates: 417
  - `leg-2016-2020` Deputies mandates: 361
  - historical party rows present: ALDE, PC, PDL, PMP, PP-DD, PRO România, UNPR
  - no unscoped Deputies member ID spans multiple legislatures.
- Verification:
  - `npm run typecheck` passed.
  - `npm run test` passed.

## 2026-05-16 — Deputies Historical Rosters: 2008-2012 and 2004-2008

- Corrected USL modelling: USL is not a party row in this app. It is a
  coalition/alignment concept involving PSD and PNL and belongs in future
  government/composition alignment data, not `parties`.
- Added 2008-2012 and 2004-2008 to the roster legislature catalog.
- Added parser support for older real parties observed in official CDEP rows:
  - PD
  - PRM
  - PUR
- Added explicit coalition-text guards so labels like USL, PSD+PC, and DA
  PNL-PD do not create party affiliation rows.
- Verified official CDEP profile pages for `leg=2008` and `leg=2004`.
  Historical group index URLs for those terms returned 404, so profile-ID
  scanning remains the reliable official source path for Deputies.
- Dry scans:
  - 2008-2012: 339 valid Deputies profiles from IDs 1-650.
  - 2004-2008: 378 valid Deputies profiles from IDs 1-650.
- Imported 2008-2012 Deputies from official CDEP profile pages:
  - 339 members
  - 339 mandates
  - 8 groups
  - 6 parties
  - 456 group memberships
  - 335 party affiliations
  - 802 committee memberships
- Imported 2004-2008 Deputies from official CDEP profile pages:
  - 378 members
  - 378 mandates
  - 8 groups
  - 9 parties
  - 504 group memberships
  - 476 party affiliations
  - 797 committee memberships
- Refreshed people linkage after the new historical imports:
  - 2440 members read
  - 1679 people upserted
  - 2440 members linked
- Database verification:
  - `leg-2008-2012` Deputies mandates: 339
  - `leg-2004-2008` Deputies mandates: 378
  - historical party rows present include PD, PRM, and PUR.
  - `party-usl` is not present.
  - no unscoped Deputies member ID spans multiple legislatures.

## 2026-05-16 — Deputies Historical Rosters: 2000-2004 to 1990-1992

- Confirmed the Wikipedia chamber index pages link legislature pages for both
  Deputies and Senate back to 1990. These pages are useful as discovery and
  sanity-check maps, while official Parliament pages remain the import source.
- Verified official CDEP profile pages for:
  - `leg=2000`
  - `leg=1996`
  - `leg=1992`
  - `leg=1990`
- Added 2000-2004, 1996-2000, 1992-1996, and 1990-1992 to the roster
  legislature catalog.
- Added parser support for older real parties observed in official CDEP rows:
  - PDSR
  - PSDR
  - FSN
  - FDSN
  - PNȚCD
  - PUNR
  - PDAR
  - PER
  - MER
  - PSM
  - PAC
  - PL '93
- Kept coalition/alliance labels such as CDR and USD out of `parties`; those
  should be modelled later as coalition/alignment records.
- Hardened member slug upserts. If a concurrent or historical import introduces
  the same display-name slug, persistence retries with the deterministic
  member-id suffix instead of failing.
- Dry scans:
  - 2000-2004: 393 valid Deputies profiles from IDs 1-750.
  - 1996-2000: 367 valid Deputies profiles from IDs 1-750.
  - 1992-1996: 381 valid Deputies profiles from IDs 1-750.
  - 1990-1992: 448 valid Deputies profiles from IDs 1-750.
- Imported 2000-2004 Deputies from official CDEP profile pages:
  - 393 members
  - 393 mandates
  - 8 groups
  - 9 parties
  - 450 group memberships
  - 522 party affiliations
  - 595 committee memberships
- Imported 1996-2000 Deputies from official CDEP profile pages:
  - 367 members
  - 367 mandates
  - 10 groups
  - 10 parties
  - 439 group memberships
  - 317 party affiliations
  - 565 committee memberships
- Imported 1992-1996 Deputies from official CDEP profile pages:
  - 381 members
  - 381 mandates
  - 12 groups
  - 11 parties
  - 439 group memberships
  - 301 party affiliations
  - 540 committee memberships
- Imported 1990-1992 Deputies from official CDEP profile pages:
  - 448 members
  - 448 mandates
  - 8 groups
  - 12 parties
  - 448 group memberships
  - 394 party affiliations
  - 651 committee memberships
- Refreshed people linkage after the full Deputies historical import:
  - 4029 members read
  - 2706 people upserted
  - 4029 members linked
- Database verification:
  - Deputies mandates now exist for every legislature from 1990-1992 through
    2024-2028.
  - older party rows present include FSN, FDSN, PDSR, PSDR, PNȚCD, PUNR, PDAR,
    PER, MER, PSM, and PL '93.
  - no unscoped Deputies member ID spans multiple legislatures.

## 2026-05-16 — Date-Bounded Chamber Seat Maps

- Fixed vote chamber maps so the roster is built from mandates active on the
  vote date, bounded by the mandate period and the legislature end date.
- Fixed group coloring for vote maps to use the group membership active on the
  vote date, instead of the newest imported membership.
- Verified the root cause on a 2025 Deputies vote:
  - unbounded historical Deputies mandates: 3771
  - fixed date-bounded active Deputies mandates: 331
- Adjusted the `Compoziții` sticky stage so it is viewport-bounded and
  internally scrollable. This keeps the lower chamber reachable while moving
  through the timeline.
- Reduced composition map minimum heights and allowed the two chamber maps to
  sit side by side on very wide screens.
- Compacted composition timeline payloads from about 65 MB to about 7.9 MB by
  sending only the member/group fields used by the UI.
- Replaced mobile per-stop full seat maps with compact chamber summaries, so
  the server does not render every historical chamber map at once.

## 2026-05-16 — Legislature Filters for Directories

- Added a shared `legislature` URL filter for vote and project explorers.
- Populated directory filter options from the `legislatures` table, ordered by
  newest election period first.
- Vote filters now constrain `held_on` to the selected legislature period.
- Project filters now constrain the known parliamentary date to the selected
  legislature period.
- Added a legislature selector to the members directory.
- Member rows now resolve the mandate and group context inside the selected
  legislature period, instead of always showing the newest imported group.
- Tightened project sponsor group filtering so a sponsor group only matches
  when the member's group membership overlaps the project date.
- Made group/party filter options dynamic. When a legislature is selected, the
  selector now includes only groups that had member memberships overlapping
  that legislature.
- Member group chips now include the chamber label, so same-name groups from
  Senate and Deputies are distinguishable.
- Data check examples:
  - `2020-2024`: 12 period-relevant chamber groups
  - `2012-2016`: 10 period-relevant chamber groups
  - `2004-2008`: 8 period-relevant chamber groups

## 2026-05-17 — 2025 Bills/Votes Coverage Audit

- Confirmed the database does not yet contain all 2025 bills/votes.
- Current imported 2025 votes after audit:
  - Senate: 2
  - Deputies: 64
- Current imported 2025 projects after the first bounded import batch:
  - Senate: 11
  - Deputies: 20
- Fixed `import:pending --years=<year>` so pending imports are constrained by
  `source_discoveries.discovered_on`.
- Found an old 2015 Deputies vote (`idv=12774`) at the front of the unfiltered
  pending queue, which explains why broad vote imports were pulling old pages.
- Updated Deputies yearly-list discovery from the obsolete `/pls/...` URL to
  the working official `/ords/pls/proiecte/upl_pck2015.lista?anp=<year>` URL.
- Verified the official 2025 Deputies yearly project list:
  - expected records: 592
  - discovered records: 592
- Imported a bounded 2025 Deputies project batch:
  - 20 imported
  - 0 partial
  - 0 failed
- Tried all-month Deputies vote discovery for 2025, but it ran too long as one
  job. Next pass should run month-scoped vote discovery batches and add better
  progress logging/timeouts.

## 2026-05-17 — Legislature Timeline + Public-Ready Data Pass

- Added derived read-model tables:
  - `member_legislature_activity`
  - `entity_search_index`
  - `bill_vote_summaries`
  - `vote_coverage_summaries`
- Added query indexes for member mandates, group/party memberships, sponsors,
  group vote totals, and nominal votes.
- Added `ingest:refresh-read-models` and wired pending/backfill/daily import
  flows to refresh read models after successful import batches.
- Added stale-running ingestion-run cleanup before starting a new run of the
  same kind.
- Optimized member profile loading so the selected legislature fetches only
  period-scoped votes/proposals instead of reading all historical votes and
  bills into the page.
- Added a member profile legislature selector with period-scoped activity,
  vote coverage, votes, and proposals.
- Changed `Compoziții` from cabinet-first timeline stops to legislature-first
  timeline sections with nested events and governments.
- Split the desktop `Compoziții` experience into three columns:
  - legislature/event rail;
  - active government/PM panel;
  - compact Senate and Deputies maps.
- Replaced visible `Hot` wording with neutral public-interest language while
  keeping the internal `hot` reaction key for compatibility.
- Added a client locale switcher that preserves the current path and query
  params when switching between Romanian and English.
- Verification:
  - `npm run typecheck` passed.
  - `npm run test` passed.
  - `npm run build` passed with escalation because Turbopack worker binding is
    sandbox-blocked.
  - Browser smoke passed locally for `/ro`, `/ro/compozitii`, `/ro/votes`,
    `/ro/bills`, and `/ro/members/andra-bica`.
  - Locale switch smoke confirmed `/ro/members/andra-bica?legislature=leg-2024-2028`
    links to `/en/members/andra-bica?legislature=leg-2024-2028`.
- Neon migration/read-model refresh:
  - migrations `0005` and `0006` applied successfully.
  - first refresh failed because overlapping legislature periods produced
    duplicate entity-search rows for a bill.
  - fixed entity-search refresh to choose one row per entity.
  - refreshed read models:
    101 bill summaries, 68 vote coverage rows, 4087 member-legislature activity
    rows, and 4287 search-index rows.

## 2026-05-17 — One-By-One Backfill Continuation

- Verified the simplified member party/group filters on Vercel:
  - `/ro/members?legislature=leg-2024-2028` now shows one chip per party/group
    under `Toți`, not separate `PSD · Senat` / `PSD · Camera Deputaților`
    style chips.
  - `group=group-name:psd` returns both Deputies and Senate rows.
  - adding `chamber=senate` narrows the same party/group filter to Senate rows.
- Ran a bounded daily sync against Neon:
  - 399 discoveries found;
  - 3 imports;
  - 0 partial;
  - 0 failed;
  - refreshed read models to 104 bill summaries, 68 vote coverage rows, 4087
    member-legislature activity rows, and 4290 search-index rows.
- Imported the next bounded Deputies 2025 project batch:
  - 10 project pages imported;
  - 0 partial;
  - 0 failed;
  - refreshed read models to 114 bill summaries and 4300 search-index rows.
- Smoke-checked Vercel after the batch:
  - `/ro/votes`, `/ro/bills`, one member profile, one vote detail page, and one
    bill detail page all returned `200`.
- Ran March 2025 Deputies vote discovery:
  - 145 official links discovered;
  - the bounded vote import found no new pending Deputies vote rows for that
    scoped batch.
- Ran Senate 2025 generated `B1-B100` discovery:
  - 100 Senate bill candidate URLs discovered.
- Found and fixed a Senate discovery/import dedupe issue:
  - generated Senate candidates now store `discovered_on` from the requested
    target year, so `--years=2025` imports can pick them up reliably;
  - discovery upserts now check the deterministic discovery ID before inserting,
    preventing duplicate primary-key failures when official pages expose the
    same related source through a different URL path.
- Re-ran Senate `B1-B100` discovery after the fix and imported a controlled
  Senate bill batch:
  - 5 imported;
  - 0 partial;
  - 0 failed;
  - refreshed read models to 115 bill summaries and 4301 search-index rows.

## 2026-05-17 — Targeted Senate Retry

- Added targeted pending-import filters:
  - `--official-id=<id>`;
  - `--source-url=<url>`.
- Used the new filter to retry only the previously failed Senate discovery
  `L522/2025`.
- Retry result:
  - 1 imported;
  - 0 partial;
  - 0 failed.
- Updated discovery status handling so successful imports clear stale
  `failure_count` and `last_error` values.
- Cleaned the already-imported `L522/2025` Neon row after the retry.
- Senate 2025 bill discovery status after cleanup:
  - 93 pending;
  - 8 imported;
  - 0 failed.

## 2026-05-17 — Senate 2025 Backfill Batch

- Imported the next bounded Senate 2025 bill batch from pending discoveries:
  - 10 imported;
  - 0 partial;
  - 0 failed;
  - 0 skipped.
- Senate 2025 bill discovery status after the batch:
  - 83 pending;
  - 18 imported;
  - 0 failed.
- Smoke-checked the live Vercel projects page:
  - `/ro/bills` returned `200`.

## 2026-05-17 — 2025 Backfill Continuation Checkpoint

- Continued the 2025 pending queue in controlled batches.
- Completed the previously discovered Senate 2025 bill queue:
  - Senate bill discoveries reached 101 imported / 0 pending / 0 failed before
    later cross-links added more official Senate bill pages.
- Completed the then-pending Senate vote queue:
  - 9 pending votes were processed;
  - one large batch was stopped after running too long, but had already imported
    6 rows;
  - the remaining 3 were retried by exact source URL and imported cleanly.
- Imported additional Deputies 2025 project batches:
  - one interrupted 50-page batch imported 47 rows before being stopped;
  - three completed batches imported 20, 50, and 50 rows.
- Cleared side discoveries produced by those project pages:
  - 82 additional Senate bill pages imported;
  - 35 additional Senate vote pages imported;
  - 19 additional Deputies vote pages imported.
- Current 2025 discovery status after this checkpoint:
  - Senate bills: 183 imported;
  - Senate votes: 57 imported, 27 pending;
  - Deputies bills: 218 imported, 374 pending;
  - Deputies votes: 46 imported;
  - failed rows: 0.
- Smoke-checks after the checkpoint:
  - `/ro/bills` returned `200`;
  - `/ro/votes` returned `200`.

## 2026-05-18 — UI Bug Fix Pass

- Fixed `Compoziții` rendering empty even though government skeleton data was
  present:
  - government and composition-event rows without `legislature_id` are now
    attached to legislatures by date overlap;
  - local browser verification showed 10 legislatures and 85 events rendering
    with Chamber/Senate seat maps.
- Improved vote seat-map interaction:
  - first click on a seat pins a popup;
  - second click on the same seat opens the member profile;
  - muted/unselected seats can still raise their popup above the circles;
  - edge popups are aligned so they do not clip off the graph container.
- Fixed homepage public-interest dashboard behavior:
  - homepage is forced dynamic so reaction counts are not served stale;
  - monthly aggregate queries use PostgreSQL `date_trunc('month', now())`;
  - dashboard panels now tolerate partial aggregate failures instead of hiding
    all trend panels;
  - local browser verification showed `Voturi cu interes public` populated from
    stored reactions.
- Verified production reaction API stores a vote reaction and returns a count.
- Checks:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed.

## 2026-05-18 — Cleared 2025 Discovery Queue

- Completed the remaining 2025 pending imports against Neon:
  - imported the remaining 27 Senate vote rows;
  - imported 374 pending Deputies bill rows;
  - imported 2 additional Senate bill cross-links;
  - imported 2 additional Senate vote cross-links;
  - imported 110 additional Deputies vote rows discovered from project pages;
  - skipped 2 additional Deputies vote pages that were not usable nominal vote
    pages.
- Fixed a backfill reliability issue in `fetchOfficialSource`:
  - the normal fetch path already had a 30 second timeout;
  - the insecure-TLS fallback used by some CDEP endpoints now has the same
    timeout so official pages cannot hang a batch indefinitely.
- Final 2025 discovery status:
  - Senate bills: 185 imported;
  - Senate votes: 86 imported;
  - Deputies bills: 592 imported;
  - Deputies votes: 156 imported, 4 skipped;
  - 0 pending;
  - 0 failed.
- Checks:
  - `npm run typecheck` passed;
  - `npm --workspace @cumsevoteaza/ingest run test -- src/__tests__/discovery.test.ts src/__tests__/chamber-vote.test.ts` passed.

## 2026-05-18 — Cleared 2026 Discovery Queue

- Refreshed 2026 discovery against Neon:
  - Deputies yearly project list returned 402 official projects;
  - Deputies electronic-vote discovery ran for January-May 2026.
- Completed the 2026 pending imports:
  - imported 399 pending Deputies bill rows;
  - imported 97 linked Senate bill rows produced by the Deputies bill pages;
  - imported 81 linked Senate vote rows produced by the Senate bill pages;
  - imported 65 Deputies vote rows;
  - skipped 2 Deputies vote pages that were not usable nominal vote pages.
- Final 2026 discovery status:
  - Senate bills: 100 imported;
  - Senate votes: 85 imported;
  - Deputies bills: 402 imported;
  - Deputies votes: 63 imported, 2 skipped;
  - 0 pending;
  - 0 failed.

## 2026-05-18 — Paused 2024 Import Checkpoint

- Started the 2024 backfill pass:
  - Deputies yearly project discovery returned 684 official projects;
  - Deputies electronic-vote discovery returned 1,316 raw vote rows, but most
    raw vote rows are undated in the discovery table, so the import stayed
    constrained to dated 2024 rows and links produced by project pages.
- Imported before pause:
  - 684 Deputies bill rows;
  - 5 linked Senate bill rows;
  - 4 linked Senate vote rows;
  - 126 Deputies vote rows.
- Paused on request by stopping the active Deputies vote importer.
- Current dated discovery checkpoint:
  - 2024: 684 Deputies bills imported, 5 Senate bills imported, 4 Senate votes
    imported, 126 Deputies votes imported, 29 Deputies votes pending;
  - 2025: 87 newly discovered Senate bill links pending, 78 newly discovered
    Deputies vote links pending;
  - 2026: 10 newly discovered Deputies vote links pending.
- Next import step:
  - clear the 29 dated 2024 Deputies votes first;
  - then inspect the new 2025/2026 lifecycle links produced by the 2024 pages
    before importing them.

## 2026-05-18 — Vote Detail UX Fixes and Daily Cron Diagnosis

- Fixed the vote detail seat-map annotations:
  - group filters now support selecting multiple groups and deselecting them;
  - vote-choice filters now support selecting multiple choices and deselecting
    them;
  - filter buttons include counts, so the duplicate vote-count legend under the
    seat map was removed;
  - the group distribution table now has an explicit header;
  - the nominal vote table is internally scrollable/resizable and shares the
    same group/vote filters as the seat map;
  - member popups render above the graph and contain an explicit profile link.
- Fixed the inflated `398`-seat Deputies map on the selected 2026 vote:
  - the nominal source has 281 named rows;
  - the previous absent-seat fill pulled every active-looking mandate in the DB,
    including historical/replacement rows with weak end dates;
  - synthetic absent seats are now capped by the known chamber size for the vote
    date and legislature, so the 2024-2028 Deputies map renders 331 seats.
- Investigated the 2026-05-18 daily sync:
  - Neon had no votes dated `2026-05-18`;
  - Neon did contain 3 Deputies bills submitted on `2026-05-18`;
  - the latest cron run was still marked `running`, suggesting the function was
    killed before completing;
  - the old Vercel schedule ran at 05:15 Bucharest time, before same-day votes
    were likely published;
  - the daily sync discovered bills but did not discover Deputies vote calendar
    pages.
- Patched daily sync behavior:
  - Vercel Cron now runs at 19:15 UTC / 22:15 Bucharest;
  - the cron route max duration is 300 seconds;
  - default daily imports are capped at 5;
  - daily sync discovers current-month Deputies vote pages in addition to bills;
  - imports are constrained to the active sync year so old paused queues do not
    consume the daily run first.
- Current limitation:
  - Senate same-day final-vote discovery still needs a first-class daily source
    path; current Senate vote discovery mainly arrives through bill lifecycle
    pages.
- Party visual identity research decision:
  - prefer official BEC/AEP electoral-sign material for legislature/election
    period logos;
  - party websites can be fallback sources only when time-scoped and clearly
    marked;
  - model these as temporal visual identities, not as one permanent logo field.
- Checks:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - local browser smoke verified the selected vote renders 331 seats, multi-party
    filtering, shared table filters, and the member popup profile link.

## 2026-05-19 — Chamber Vote Member Identity Repair

- Investigated the live annotation where a PNL seat displayed as
  `Buzoianu Diana-Anda`.
- Root cause:
  - the selected CDEP vote row with `idm=56` is officially
    `Ciobanu Adrian-Virgil`, PNL;
  - `Buzoianu Diana-Anda` is official CDEP `idm=48`, USR;
  - Chamber vote imports were upserting vote-page member rows into the shared
    `members` table and could overwrite roster-backed member identity rows.
- Code fix:
  - Chamber vote persistence now inserts missing vote-page members only;
  - existing roster-backed `members` rows are no longer overwritten by vote
    imports.
- UI fix:
  - the pinned/hovered seat popup is now the profile link itself;
  - the visible `Deschide profilul` / `Open profile` line was removed.
- Data repair performed against Neon:
  - reran the official 2024 Deputies roster import;
  - refreshed people links;
  - verified `member-deputies-48` = `Buzoianu Diana-Anda`, USR;
  - verified `member-deputies-56` = `Ciobanu Adrian-Virgil`, PNL;
  - verified the selected vote row now resolves `member-deputies-56` as
    `Ciobanu Adrian-Virgil`, PNL, `Pentru`.
- Checks:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - local browser smoke verified the vote page shows no visible
    `Deschide profilul` text and has a whole-popup member profile link.

## 2026-05-19 — Deputies Roster Cleanup and Shared Seat Counts

- Fixed the Deputies profile parser so constituency is read from the scoped
  official profile details row, not from flattened whole-page text.
- Added parser support for CDEP month-level movements:
  - `până în mai 2026` becomes an ended interval;
  - `din mai 2026` becomes a new interval.
- Added a regression fixture for Gavrilă Anamaria’s official CDEP profile
  structure, including POT/UPR rows and party image cells.
- Fixed roster assembly so profile-derived temporal group/party rows take
  precedence over group-list fallback rows when profiles are available.
- Fixed roster persistence so member detail rows from a roster import are
  authoritative and stale group, party, committee, and role rows are deleted
  before reinsert.
- Reimported the official 2024 Deputies roster into Neon after the fixes:
  - group counts matched all official CDEP group counts;
  - Gavrilă Anamaria now has clean `HUNEDOARA` constituency;
  - Gavrilă Anamaria now has two official-source temporal group rows:
    POT from 2024-12-21 through 2026-05-31 and UPR from 2026-05-01 onward;
  - party rows follow the same POT/UPR temporal split.
- Added a shared site-wide chamber seat-count helper using the historical seat
  totals provided for 1990-present legislatures, including 2024 as
  134 Senate / 331 Deputies.
- Applied the shared seat-count helper to vote seat maps and composition maps
  so oversized active-looking mandate sets are capped consistently.
- Updated the member directory table with internal scrolling, sticky headers,
  and defensive constituency cleanup for older rows not yet reimported.
- Logo note:
  - official CDEP pages expose party image assets like `/aleg/pot2024.jpg` and
    `/aleg/upr2026.jpg`;
  - the next durable step is a `party_visual_identities` model keyed by
    party/election period/legislature, not a single permanent party logo.

## 2026-05-19 — Roster Spring Cleaning

- Paused bills/votes work and reset the roster layer because old importer and
  vote-derived rows had polluted member pages and composition counts.
- Added `ingest:roster:reset`:
  - dry-run by default;
  - `--confirm` clears rebuildable roster/read-model tables only;
  - leaves bills, votes, individual vote rows, parties, groups, member identity
    rows, and source snapshots intact.
- Ran the reset against Neon. Deleted/rebuildable rows before reset:
  - 4,219 mandates;
  - 5,319 group memberships;
  - 4,033 party affiliations;
  - 8,341 committee memberships;
  - 91 member roles;
  - 4,219 member-legislature activity rows.
- Reimported official current rosters:
  - 2024 Deputies: 330 members, 330 mandates, 389 group memberships, 354 party
    affiliations, 817 committee memberships, 24 roles;
  - 2024 Senate: 134 members, 134 mandates, 134 group memberships, 135 party
    affiliations, 403 committee memberships, 36 roles.
- Reimported official CDEP Deputies profiles for historical legislatures:
  - 2020-2024: 354 Deputies who served;
  - 2016-2020: 361;
  - 2012-2016: 417;
  - 2008-2012: 339;
  - 2004-2008: 378;
  - 2000-2004: 393;
  - 1996-2000: 367;
  - 1992-1996: 381;
  - 1990-1992: 448.
- Rebuilt people links and read models after the reset:
  - 4,111 members read;
  - 2,724 people upserted;
  - 4,111 members linked;
  - 6,891 search index rows refreshed.
- Verification:
  - every imported mandate/chamber has `dirty_constituencies = 0`;
  - 2024 current counts now show 134 Senate mandates and 330 Deputies mandates
    from official active roster imports;
  - impossible membership periods with `ends_on < starts_on` were cleaned.
- Remaining roster gap:
  - historical Senate rosters are not yet imported from official sources;
  - CDEP mandate end-date parsing is still needed so people who served earlier
    in a legislature but later left the mandate do not appear as active in
    current composition views.

## 2026-05-19 — Wikipedia Roster Cross-Check Start

- Added Wikipedia roster parsing as a secondary evidence layer:
  - `ingest:wikipedia:roster` parses election pages such as the 2020 list;
  - `ingest:wikipedia:roster-index` discovers legislature links from the
    Deputies/Senate index pages;
  - `ingest:roster:crosscheck` compares parsed Wikipedia rows with official
    DB roster rows without overwriting official data.
- Added `PLUS` to the party catalog so 2020 USR PLUS-era rows can be
  represented instead of being collapsed silently.
- Added parser fixtures/tests for:
  - Wikipedia election pages containing both chamber tables;
  - Wikipedia legislature index links;
  - CDEP historical profile titles with spaced hyphens.
- Live 2020 Wikipedia roster parse:
  - 467 rows parsed;
  - expected text counts: 330 Deputies and 136 Senators;
  - actual parsed tables: 331 Deputies and 136 Senators;
  - unknown party labels: `Independent`.
- First cross-check exposed malformed official CDEP historical names caused by
  titles like `Benga Tudor - Vlad` being parsed as only `Vlad`.
- Fixed the CDEP profile parser to preserve the full spaced-hyphen name, then
  reimported the official 2020 Deputies profile range into Neon:
  - 354 members;
  - 354 mandates;
  - 441 group memberships;
  - 369 party affiliations;
  - 1,000 committee memberships.
- Rebuilt people links and read models:
  - 4,111 members read;
  - 2,726 people upserted;
  - 4,111 members linked;
  - 6,892 search-index rows refreshed.
- 2020 cross-check after repair:
  - Deputies: 330 matches against Wikipedia, 1 Wikipedia row not matched
    (`Vlad Popescu`), 24 official CDEP rows not present in Wikipedia’s elected
    list, 11 party mismatches where Wikipedia keeps `PLUS` and official CDEP
    reports `USR`;
  - Senate: 136 Wikipedia rows are available, but official historical Senate
    rows are not imported yet.

## 2026-05-19 — Wikipedia Roster Cross-Checks Across All Legislatures

- Extended the Wikipedia roster parser so it can handle every post-1989 page
  family needed for cross-checking:
  - normalized `rowspan` / `colspan` tables, fixing 2024-style carried
    party/county cells;
  - inferred chamber from split legislature-page URLs such as
    `Legislatura_1990-1992_(Senat)`;
  - parsed older `Nume si Prenume` / `Județ` / `Partid` tables;
  - widened party recognition for current labels such as `S.O.S. România` and
    `Uniunea Democrată Maghiară din România`.
- Added all-legislature commands:
  - `npm run ingest:wikipedia:roster:all -- --no-files`;
  - `npm run ingest:roster:crosscheck:all -- --no-files`.
- Changed Wikipedia defaults:
  - 2016, 2020, and 2024 use the election-list page;
  - 2008, 2012, and 1990-2004 use split Senate/Deputies legislature pages,
    because the 2008/2012 election-list pages do not expose the same robust
    combined table format.
- Live parse counts after the change:
  - 2024-2028: 465 rows, 331 Deputies / 134 Senate;
  - 2020-2024: 467 rows, 331 Deputies / 136 Senate;
  - 2016-2020: 469 rows, 333 Deputies / 136 Senate;
  - 2012-2016: 591 rows, 412 Deputies / 179 Senate;
  - 2008-2012: 470 rows, 333 Deputies / 137 Senate;
  - 2004-2008: 552 rows, 386 Deputies / 166 Senate;
  - 2000-2004: 555 rows, 393 Deputies / 162 Senate;
  - 1996-2000: 521 rows, 367 Deputies / 154 Senate;
  - 1992-1996: 539 rows, 381 Deputies / 158 Senate;
  - 1990-1992: 576 rows, 448 Deputies / 128 Senate.
- Important interpretation:
  - newer election-list pages are close to elected seat counts;
  - older split legislature pages often include everyone who served during the
    term, including replacements, so they are useful for member history but
    must not be used as raw seat-map counts.

## 2026-05-19 — Compoziții Scroll Activation Fix

- Fixed the desktop `Compoziții` timeline stage so the sticky government and
  chamber map panels follow the legislature section under a viewport marker.
- Replaced the prior `IntersectionObserver` ratio selection, which could keep
  the first/current legislature active while older timeline cards were visible.
- Verified locally that scrolling to 2020-2024, 2016-2020, 2012-2016, and
  2008-2012 updates the active stage text and chamber map counts for that
  legislature.

## 2026-05-19 — Wikipedia Fallback Senate Rosters Imported

- Added a provenance-aware Wikipedia roster import path for historical Senate
  gaps:
  - `npm run ingest:wikipedia:roster:import -- --all --chamber=senate --skip-existing --persist --no-files`.
  - Existing official 2024 Senate mandates are detected and skipped.
  - Imported fallback rows keep Wikipedia source URLs and snapshot IDs.
- Imported historical Senate fallback mandates into Neon:
  - 2020-2024: 136;
  - 2016-2020: 136;
  - 2012-2016: 179;
  - 2008-2012: 137;
  - 2004-2008: 166;
  - 2000-2004: 162;
  - 1996-2000: 154;
  - 1992-1996: 158;
  - 1990-1992: 128.
- Rebuilt people links and read models after the import:
  - people backfill: 5,467 members read, 3,614 people upserted, 5,466 members linked;
  - read models: 2,196 bill/vote summaries, 553 vote coverage summaries,
    5,258 member legislature activity rows, 8,249 search-index rows.
- Verified `Compoziții` now renders capped Senate seat maps for every
  legislature:
  - 2024: 134 Senate / 330 Deputies;
  - 2020: 136 Senate / 330 Deputies;
  - 2016: 136 Senate / 329 Deputies;
  - 2012: 176 Senate / 412 Deputies;
  - 2008: 137 Senate / 334 Deputies;
  - 2004: 137 Senate / 314 Deputies;
  - 2000: 140 Senate / 345 Deputies;
  - 1996: 143 Senate / 343 Deputies;
  - 1992: 143 Senate / 341 Deputies;
  - 1990: 119 Senate / 396 Deputies.
- Caveat: older Wikipedia split legislature pages can list everyone who served
  during a term, not only exact simultaneous seat holders. The UI therefore
  uses fixed formal seat counts for chamber maps while preserving the larger
  member lists for parliamentary history.

## 2026-05-19 — Official CDEP Career Importer + Compoziții Repairs

- Added an official CDEP career importer:
  - `npm run ingest:official-careers -- --url=<structura.mp URL> --persist`;
  - supports CDEP Deputies profiles and CDEP-hosted Senate profiles through
    `cam=2` and `cam=1`;
  - follows the old-profile `Activitate parlamentară` links across chambers and
    legislatures.
- Added `member_mandate_relations` for official replacement relationships:
  - relation type `replaces`;
  - related member name;
  - related official profile URL;
  - source snapshot traceability.
- Added `logo_url` to party and group membership rows so official CDEP
  `/aleg/...` period logos can appear on Transfermarkt-style member history
  rows without pretending one current party logo applies to every period.
- Fixed old CDEP profile name parsing:
  - generic titles like `STRUCTURA PARLAMENTULUI ROMÂNIEI 2004-2008` are now
    ignored as member names;
  - historical all-caps surnames are normalized for display, e.g.
    `Ion ROTARU` -> `Ion Rotaru`.
- Fixed historical CDEP group identity parsing:
  - non-party fallback group IDs now include the legislature;
  - `Partidul Democrat-Liberal` with a hyphen is recognized as PDL;
  - repaired existing Neon 2008 Deputies memberships that had inherited
    `group-deputies-1` / FSN, moving the 2008-2012 rows to
    `group-deputies-pdl`.
- Imported and verified official sample careers in Neon:
  - `member-senate-2004-152` now displays `Ion Rotaru`;
  - Ion Rotaru's 2004 Senate mandate stores the official replacement relation
    to Aurel Gabriel Simionescu;
  - `member-deputies-2004-64` now displays `Constantin Tămagă`.
- Refreshed people links and read models after the official imports:
  - people backfill: 5,474 members read, 3,613 people upserted, 5,473 members linked;
  - read models: 2,196 bill/vote summaries, 553 vote coverage summaries,
    5,265 member legislature activity rows, 8,256 search-index rows.
- Updated `Compoziții` behavior:
  - latest legislature keeps the current PM as the primary PM;
  - older legislatures summarize non-interim PMs by longest service;
  - seat map popups can be pinned with one click and opened by clicking the
    popup itself.
- Verification:
  - `npm run test` passed, 30 tests;
  - `npm run typecheck` passed;
  - `npm run build` passed after rerunning outside the sandbox because
    Turbopack needs local IPC/port binding.

## 2026-05-19 — Performance: Hybrid Cache + Postgres Search

- Added a web-runtime DB helper that reuses a small pooled Postgres client per
  server process while keeping importer/CLI sessions explicit and closable.
- Added lightweight data-function timing logs for development and
  `CUMSEVOTEAZA_PERF_LOG=1`.
- Added Next cache wrappers and tags for public read paths:
  - homepage dashboard, vote/project directories, vote/project/member/party
    detail pages, and `Compoziții`;
  - daily cron now revalidates `home`, `votes`, `bills`, `members`, `parties`,
    `composition`, and `search` tags after a sync run.
- Reworked hot DB reads:
  - vote detail now fetches only the requested vote, linked bill/source,
    group totals, nominal votes, and valid roster seats for that vote date;
  - member directory now uses a bounded SQL slice with search/group/legislature
    filters instead of loading the full member/mandate/membership set;
  - bill directory now uses `bill_vote_summaries`;
  - party pages now use scoped group/member/vote joins.
- Added migration `0008_lush_captain_america.sql`:
  - enables `pg_stat_statements`, `pg_trgm`, and `unaccent`;
  - adds hot-path member/vote indexes;
  - adds trigram search on `entity_search_index.search_text`;
  - adds GIN on `bills.identifiers`.
- Refreshed Neon read models after normalizing search text:
  - 2,196 bill summaries;
  - 553 vote coverage rows;
  - 5,265 member legislature activity rows;
  - 8,256 search-index rows.
- Verified Neon query plans:
  - vote-date roster lookup: about 4 ms;
  - search-index last-name lookup: about 0.2 ms using the trigram index;
  - bill directory by year: about 1.3 ms;
  - party member join sample: about 13 ms.

## 2026-05-20 — CDEP 2004 Official History Dry-Run Importer

- Added `npm run ingest:cdep-history:import` as the bridge between the
  file-first CDEP history probe and the existing Postgres roster persistence
  path.
- The command is dry-run by default and only writes when `--persist` is passed.
  It converts official `profiles.jsonl` rows into the app's `ParsedRoster`
  shape, including:
  - CDEP profile source snapshots;
  - official member ids;
  - mandates;
  - party affiliations;
  - parliamentary group memberships;
  - committee memberships;
  - replacement relations;
  - official profile photos and period logo URLs.
- Replacement relation handling is conservative:
  - bad probe link matches such as numeric pagination labels are ignored;
  - the importer recovers the replaced member name from raw
    `inlocuieste pe:` profile text when available;
  - related member ids are attached only when the related profile key is
    genuinely different and available in the same batch.
- Ran the 2004 dry run:
  - Deputies: 378 sources, 378 members, 378 mandates, 43 replacement relations;
  - Senate: 163 sources, 163 members, 163 mandates, 21 replacement relations.
- Warnings from the dry run:
  - 20 Deputy mandates have no official constituency link; these are national
    minority-style rows from the official pages, not random parser misses;
  - historical labels that are not canonical parties are stored as scoped
    formations for now.
- Saved the missing-constituency warnings for manual review:
  - `data/cdep-history/reports/manual-warning-review-2004-2008.json`;
  - `data/cdep-history/reports/manual-warning-review-2004-2008.csv`;
  - each row includes legislature, chamber, member name, official id, profile
    key, official profile URL, validation date, party labels, and group labels.
- Local Docker/Postgres write is blocked because the Docker daemon is not
  reachable and `127.0.0.1:5432` is closed. Next step is to start Docker, run
  migrations locally if needed, then rerun the same importer with `--persist`
  against local Postgres before touching Neon.
- Docker was later started and the local Postgres container was healthy.
- Applied local Drizzle migrations successfully.
- Applied the 2004 official CDEP import to local Postgres:
  - mandate counts: 378 Deputies, 163 Senate;
  - replacement relation counts: 43 Deputies, 21 Senate;
  - missing constituency count: 20 Deputies, matching the manual review file.
- Verified known official profiles locally:
  - `member-deputies-2004-64` -> Constantin Tămagă;
  - `member-senate-2004-152` -> Ion Rotaru.
- Refreshed local people links and read models:
  - people backfill: 1,005 members read, 998 people upserted, 1,005 members linked;
  - read models: 1,005 member legislature activity rows and 1,040 search-index rows.
- Applied the verified 2004 official CDEP import to Neon:
  - Deputies imported first with 378 official CDEP mandates;
  - the combined production import stalled after Deputies, so roster persistence
    was changed from broad `Promise.all` writes to controlled sequential writes
    for Neon reliability;
  - Senate then imported successfully with 163 official CDEP mandates.
- Cleaned superseded 2004 Senate Wikipedia-derived rows from Neon:
  - removed 166 old non-CDEP Senate mandates plus their old membership and
    affiliation rows;
  - final 2004 Neon counts are 378 Deputies mandates and 163 Senate mandates,
    with 0 non-CDEP mandates for that legislature.
- Verified known official profiles in Neon:
  - `member-deputies-2004-64` -> Constantin Tămagă;
  - `member-senate-2004-152` -> Ion Rotaru.
- Refreshed Neon read models after the cleanup:
  - 2,196 bill/vote summaries;
  - 553 vote coverage summaries;
  - 5,261 member legislature activity rows;
  - 8,436 search-index rows.
- People links were verified at 5,473 linked members. The long-running
  `people:backfill` process was stopped after it became idle and the linked
  count had reached the existing verified level.

## 2026-05-20 — Python Data Pipeline Umbrella

- Locked the architecture direction:
  - Next.js remains the public web/API backend;
  - Neon remains source of truth;
  - Python is for local-first data engineering work;
  - TypeScript remains the only canonical DB persistence layer.
- Added `tools/parliament-pipeline`, a broader Python pipeline entrypoint.
- Added root command:
  - `npm run pipeline:parliament -- domains`;
  - `npm run pipeline:parliament -- plan historical-members`;
  - `npm run pipeline:parliament -- cdep-members <command>`.
- Kept the existing CDEP command stable:
  - `npm run probe:cdep-history -- ...`.
- The umbrella pipeline currently delegates the implemented `cdep-members`
  domain to the proven CDEP history probe, so the 2004 workflow remains intact.
- Documented the future `votes-projects` pipeline domain as planned with
  file-first output under `data/parliament-pipeline/`.
- Added Python stdlib tests for the pipeline CLI:
  - domain metadata preserves the file-first DB boundary;
  - historical member plan keeps TypeScript as the DB writer;
  - CDEP roster URL generation delegates correctly.
- Wired Python pipeline tests into root `npm run test`.
- Verification:
  - `npm run pipeline:parliament -- domains` passed;
  - `npm run pipeline:parliament -- plan historical-members` passed;
  - `npm run pipeline:parliament -- cdep-members roster-urls --legislature 2004 --chamber both` passed;
  - `npm run typecheck` passed;
  - `npm run test` passed, including 30 Vitest tests and 3 Python unittest tests.

## 2026-05-20 — Local Official CDEP History Backfill

- Extended the CDEP history probe for full local crawling:
  - added bounded profile concurrency with `--concurrency`;
  - kept profile failures non-fatal;
  - added `data/cdep-history/parsed/profile-failures.jsonl` for failed profile
    fetches;
  - documented the failure file in the probe README.
- Ran the official CDEP crawl for all post-1989 legislatures and both chambers:
  - command:
    `npm run pipeline:parliament -- cdep-members crawl --legislature all --chamber both --no-follow-careers --delay 0.05 --concurrency 4 --insecure`;
  - first concurrent pass had 2 transient DNS/profile failures;
  - rerun reused cached raw snapshots and completed with `profilesFailed = 0`.
- Final parsed official profile counts:
  - 1990: 448 Deputies, 128 Senate;
  - 1992: 381 Deputies, 162 Senate;
  - 1996: 367 Deputies, 154 Senate;
  - 2000: 393 Deputies, 163 Senate;
  - 2004: 378 Deputies, 163 Senate;
  - 2008: 339 Deputies, 137 Senate;
  - 2012: 417 Deputies, 179 Senate;
  - 2016: 361 Deputies, 142 Senate;
  - 2020: 354 Deputies, 151 Senate;
  - 2024: 335 Deputies, 137 Senate.
- Imported the parsed profiles into local Docker Postgres, one legislature at a
  time, using the TypeScript persistence path and local `DATABASE_URL`.
- Local DB comparison:
  - CDEP-history mandate counts match the Python crawl for every
    legislature/chamber;
  - all 1990-2024 rows except 2024 Senate have `other_rows = 0`;
  - 2024 Senate has 137 CDEP-history mandates and 134 legacy
    `senate-member-profile` mandates, so source priority or cleanup must be
    decided before production import.
- Checked 2008 Deputies group labels locally after the scoped group-id fix:
  PDL, PSD, PNL, UDMR, Minorități, Neafiliați, and scoped historical labels are
  present; FSN no longer bleeds into the 2008 composition data.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed, including 30 Vitest tests and 3 Python unittest tests.

## 2026-05-20 — CDEP Canonical Cleanup + Profile Logos

- Chose CDEP-history rows as canonical for overlapping mandate/profile data
  because the official CDEP profile pages include cross-legislature links,
  replacement information, profile photos, and period logo URLs.
- Added `ingest:cdep-history:cleanup`, a dry-run-first cleanup command:
  - finds non-CDEP mandate/profile rows only where CDEP-history rows already
    exist for the same legislature and chamber;
  - removes superseded mandates and related legacy membership, affiliation,
    committee, role, governance, and composition-event rows;
  - intentionally keeps old `members` rows because some still have
    `individual_votes` references.
- Ran the cleanup locally for the duplicated 2024 Senate data:
  - dry-run found 134 superseded `senate-member-profile` mandates;
  - confirmed cleanup removed 134 mandates, 134 group memberships, 135 party
    affiliations, 403 committee memberships, and 36 role rows;
  - local 2024 Senate verification now shows 137 CDEP-history mandates and
    0 other mandate rows.
- Refreshed local read models after cleanup:
  - `memberLegislatureActivity = 5289`;
  - `entitySearchIndex = 5512`.
- Updated search indexing so member rows without any mandate are not indexed as
  public parliamentarians. This prevents retained vote-reference-only legacy
  members from showing in search after cleanup.
- Updated member profile pages to show the current period CDEP logo in the
  profile header, sourced from membership `logo_url`.
- Sample local data check:
  - Anamaria Gavrilă resolves to POT/UPR period rows with
    `https://cdep.ro/aleg/pot2024.jpg`;
  - Diana-Anda Buzoianu has USR period logo rows from CDEP profiles.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed;
  - local browser smoke-check for
    `/ro/members/anamaria-gavrila-deputies-113` found the member heading and
    CDEP logo images rendered from `cdep.ro/aleg`.

## 2026-05-20 — Neon CDEP-History Promotion + Active Composition Maps

- Optimized DB promotion writes before moving the full CDEP-history dataset to
  Neon:
  - `persistRoster` now uses batched upserts for source snapshots, parties,
    groups, members, mandates, relations, memberships, affiliations,
    committees, and roles;
  - `people:backfill` now upserts people and updates member/person links in
    batches instead of one row at a time.
- Promoted official CDEP-history rows to Neon for all post-1989 legislatures:
  1990, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, and 2024.
- Ran `ingest:cdep-history:cleanup -- --confirm --no-files` against Neon after
  promotion:
  - removed 1,324 superseded fallback/profile Senate mandates;
  - removed related legacy group memberships, party affiliations, committee
    memberships, and role rows;
  - kept legacy member identity rows where votes still reference them.
- Refreshed Neon people links and read models:
  - people backfill: 6,983 members read, 3,526 people upserted,
    6,982 members linked;
  - read models: 2,196 bill/vote summaries, 553 vote coverage summaries,
    5,289 member legislature activity rows, 8,259 search-index rows.
- Verified Neon mandate provenance after cleanup:
  - every post-1989 legislature/chamber in `member_mandates` has matching
    CDEP-history counts;
  - `other_rows = 0` for each of those legislature/chamber pairs.
- Updated `Compoziții` map selection:
  - current legislature uses today;
  - historical legislatures use a representative composition date based on
    available roster starts for both chambers;
  - memberships are now strict date-active matches for the same chamber, so
    later/future group labels are not reused on old compositions.
- Added the composition date to the pinned government stage.
- Smoke-check:
  - local `/ro/compozitii` returned `Compoziție la data`, `2024-2028`,
    `2020-2024`, and the formal current chamber counts `331` / `134`.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed.

## 2026-05-20 — Member History Track 2

- Upgraded the member profile history surface toward the Transfermarkt-style
  career view:
  - history rows now carry `legislatureId` so mandates, group rows, party rows,
    committees, roles, and replacement relations can be grouped by legislature;
  - member pages pass the available legislature list into the history table;
  - the table now renders separate legislature sections with date range,
    chamber chips, row counts, period logo cues, internal scrolling, sticky
    headers, and translated row-type labels.
- Local browser smoke-check on
  `/ro/members/anamaria-gavrila-deputies-113` verified:
  - the member profile renders;
  - POT is shown as the current period formation;
  - `Istoric parlamentar` includes a `2024-2028` legislature section;
  - party/formation rows and logo cues are visible.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed after allowing Turbopack's local helper process.

## 2026-05-20 — Current Legislature Bill/Vote Audit

- Added `npm run ingest:audit:current-legislature` as a read-only
  reconciliation command for the active legislature.
- The audit compares official discoveries and persisted records using:
  - official identifier;
  - source URL;
  - chamber;
  - date;
  - normalized title;
  - vote totals and coverage level.
- The first Neon-backed audit for `leg-2024-2028` reported:
  - discoveries: 1,366 bills and 486 votes;
  - DB rows: 1,121 bills and 420 votes;
  - pending discoveries: 87 bills and 88 votes;
  - 18 votes without linked bills;
  - 3 weak/generic Senate vote titles;
  - 203 imported/partial discoveries without a high-confidence DB match;
  - several cross-chamber split bills sharing identifiers, which should become
    the next lifecycle merge/reconciliation task instead of being auto-merged
    by title alone.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed;
  - `npm run ingest:audit:current-legislature -- --no-files --sample-limit=10`
    passed after allowing `tsx` to create its local IPC pipe.

## 2026-05-20 — Homepage and Member Directory UI Polish

- Added a compact brand mark to the header: a newspaper-style ballot with a
  hand choosing between `DA` and `NU`.
- Replaced the homepage subtitle with the requested Romanian copy and matching
  English copy.
- Started applying the warm civic palette:
  `#309898`, `#FF9F00`, `#F4631E`, and `#CB0404`.
- Added a CTA from the parliamentary-groups explainer to the member directory.
- Reworked member-directory filtering:
  - `/members` now defaults to the current legislature;
  - legislature selection is shown as period buttons under the search bar;
  - legacy/all-history group-filter URLs still work;
  - group/party chips can be multi-selected and toggled off;
  - directory SQL deduplicates rows by linked person identity where available.
- Added follow-up tasks for a real parties/groups directory and future member
  ranking panels once absence and party-movement data quality is high enough.

## 2026-05-21 — Official Asset Pipeline Steps 1-3

- Added the file-first asset inventory step:
  `npm run pipeline:parliament -- cdep-members asset-inventory`.
- The current local CDEP profile parse produced:
  - 5,289 profiles;
  - 9,225 asset records;
  - 4,801 unique official asset URLs;
  - 4,919 profile photo records;
  - 4,306 party/logo records.
- Added `stored_assets` as the Postgres metadata table for Blob-backed assets,
  with status fields for stored, missing, timeout, and failed fetches.
- Added `npm run ingest:assets:import`:
  - dry-run by default;
  - requires `--persist` and `BLOB_READ_WRITE_TOKEN` before uploading;
  - stores binary files in Vercel Blob and metadata in Postgres.
- Verification:
  - `npm run test:python-pipeline` passed;
  - `npm --workspace @cumsevoteaza/ingest test` passed;
  - `npm run typecheck` passed;
  - `npm run ingest:assets:import -- --limit=10` dry-run passed;
  - `npm run build` passed.

## 2026-05-21 — Local Asset Migration Test

- Applied the new Drizzle migration to the local Docker Postgres database by
  explicitly overriding `DATABASE_URL` with the Docker URL.
- Verified the local `stored_assets` table exists and currently has `0` rows.
- Attempted a tiny persisted asset test:
  `npm run ingest:assets:import -- --asset-type=photo --limit=3 --persist`.
- The persisted test stopped before any fetch/upload because local env files do
  not contain `BLOB_READ_WRITE_TOKEN`; only `DATABASE_URL` and
  `CUMSEVOTEAZA_SITE_PASSWORD` are present locally.
  `.env` and `.env.*` are gitignored, so the token can be added locally without
  committing it.
- After adding the Blob token locally, reran the persisted test for 3 photos.
  The command reached the official asset fetch stage and recorded 3 failed
  rows in local `stored_assets`; CDEP image requests timed out / failed while
  the official site was not responding. Blob upload verification is postponed
  until CDEP is reachable again.

## 2026-05-21 — Member Asset UI And Career Strip

- Wired member profile data to prefer successfully stored Blob assets from
  `stored_assets` for profile photos and period party logos.
- Added fallback behavior so member pages can still show official CDEP
  `profilePhoto` and membership `logoUrl` values while Blob backfill is
  postponed.
- Added a Transfermarkt-style `Traseu parlamentar` / `Parliamentary path`
  strip under the member header:
  - segments are built from temporal party/group history rows;
  - each segment shows period, chamber, color, and logo cue when available;
  - the existing detailed `Istoric parlamentar` table remains the audit layer.
- Local browser smoke-check:
  - `/ro/members/lucian-nicolae-bode-deputies-30` renders the new timeline;
  - no browser console errors were reported.
- Verification:
  - `npm run typecheck` passed;
  - `npm run test` passed;
  - `npm run build` passed.

## 2026-05-21 — Political Formation Events For Member Timelines

- Added a separate political-formation event model so party/alliance changes
  can affect member timelines without overwriting imported official mandate
  rows.
- Added curated seed data for initial high-impact transitions:
  - USL formation and dissolution;
  - PLR split from PNL;
  - ACL formation;
  - PDL merger into PNL;
  - PLR/PC merger into ALDE.
- Added `npm run ingest:political-formations:seed` to upsert those events and
  their affected parties/formations.
- Updated member profile career timelines to:
  - split overlapping PDL/PNL rows around the 2014 merger where applicable;
  - show formation events as dated sourced markers;
  - remove the previous black rail and dotted background.
- Verification:
  - `npm run typecheck` passed.
  - `npm run test` passed.
  - `npm run build` passed after running outside the sandbox because
    Turbopack needs a local helper process during CSS processing.
  - Applied the migration to Neon and seeded 6 formation events / 20 entity
    links.
  - Local browser smoke-check for
    `/ro/members/lucian-nicolae-bode-deputies-30` showed the ACL and
    PDL-to-PNL event markers and corrected PDL/PNL dates.

## 2026-05-21 — Political Entity Candidate Backlog

- Added `npm run ingest:political-entities:candidates`.
- The command reads imported party, parliamentary-group, member-affiliation,
  and member-group labels from the database and writes:
  - `data/curated/political-entity-candidates.json`;
  - `data/curated/political-entity-candidates.md`.
- Current Neon run found 113 distinct candidate labels across parties,
  historical formations, non-affiliated states, minority organizations, and
  parliamentary groups.
- The report is intentionally marked `needs_source_review` so each entity can
  be checked against Wikipedia/Google/official sources before becoming a
  curated formation event.

## 2026-05-21 — Expanded Source-Reviewed Formation Events

- Added `party_founded` and `party_reestablished` event types so long-running
  parties can keep original historical founding dates while the public
  post-1989 timeline starts from the modern reactivation.
- Expanded `data/curated/political-formation-events.json` with a first
  source-reviewed batch:
  - PNL founded in 1875 and re-established in 1990;
  - CDR, USD, DA PNL-PD, USR PLUS alliance events;
  - FDSN/PDSR/PSD, PD/PLD/PDL, PP-DD/UNPR, and PLUS/USR transitions.
- Kept uncertain year-only items out of the seed file and documented them in
  `docs/sources.md` for manual review.
- Added party-profile timeline work to `tasks.md` as a follow-up surface built
  on the same curated event table.

## 2026-05-21 — Second Formation Event Source Pass

- Expanded the curated formation event file from 18 to 33 events.
- Added exact-date events for FSN, UDMR, PRM, PUR/PC, PUNR absorption, ARD,
  PMP, PSD-UNPR-PC/ALDE, UNPR/PMP attempted merger, PRO România, AUR, and POT.
- Kept weak/partial items out of the seed: UNPR founding day, PSD+PC exact
  signing date, SOS România exact founding date, ApR exact dates, and the
  minority-organization model.

## 2026-05-21 — UNPR Romanian-Source Refinement

- Added UNPR's 1 May 2010 first-congress/leadership milestone from Romanian
  Wikipedia as the first exact public date for the party.
- Documented Tribunalul București as the future higher-confidence source for
  exact legal party registration dates.
