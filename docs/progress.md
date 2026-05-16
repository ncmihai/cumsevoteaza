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
