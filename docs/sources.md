# cumsevoteaza — Official Sources

Source notes for parsers and data reliability.

## Senate

- Bill detail/search page example:
  `https://www.senat.ro/Legis/Lista.aspx?cod=27035`
- Vote detail example:
  `https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=EF4EE11F-7327-4C71-9B76-2CB5C930E88C&Cod=27035&Data=2025-10-27`

Observed vote detail structure:
- Header includes vote date, bill code, and vote type.
- Totals appear under `.total-votes`.
- First responsive table contains group totals.
- Second responsive table contains nominal individual votes.
- Individual rows include surname, given name, group, vote columns, and vote type.

Observed bill page structure:
- Search pages can contain example text such as `L123/2025` before the actual result.
- Prefer the detail panel field `Număr de înregistrare Senat`, then the detail
  heading, then the search result table.
- Chamber identifiers can appear as `PLX429/2025`; normalize to `PL-x 429/2025`.
- The default Senate `Lista.aspx` page is a search shell and may not expose
  bill result links without a valid query/postback context. Backfill discovery
  should treat Senate list seeds as source-specific tuning work, not assume the
  default page is a complete feed.
- Senate bill detail/search pages can also be reached with
  `https://www.senat.ro/legis/lista.aspx?an_cls=<year>&nr_cls=L<number>`.
  The backfill importer supports bounded generated `L<number>/<year>` discovery
  ranges for this reason.
- Senate `Număr` values are not limited to `L<number>`. The official search
  form says the number can start with `L`, `B`, `BP`, or `PLX`; importers
  normalize these as aliases and prefer the established `L` identifier when
  an official page links multiple identifiers for the same project.
- Senate bill pages can act as a complementary lifecycle source. Dated timeline
  rows may expose Senate lifecycle events plus nested official links to Senate
  vote details, Chamber nominal vote pages, and Chamber bill detail pages. The
  importer stores these links as resumable discoveries instead of trying to
  infer missing lifecycle data.
- Senate bill pages include in-page tab anchors such as `#profile` and `#buzz`.
  These are not independent official sources and must be ignored by discovery.

## Chamber of Deputies

- Current public site pages use `cdep.ro/ords/pls/parlam/structura2015.*`
  endpoints for 2024-present structure:
  - Group index cards are linked from
    `https://cdep.ro/ords/pls/dic/site2015.home?idl=1`.
  - Group details use
    `https://cdep.ro/ords/pls/parlam/structura2015.gp?cam=2&leg=2024&idl=1&idg=<id>`.
  - Member profiles use
    `https://cdep.ro/ords/pls/parlam/structura2015.mp?idm=<id>&cam=2&leg=2024`.
- Node's built-in fetch can reject the Chamber certificate chain. The importer
  falls back to `curl` for that specific fetch failure while still storing
  source snapshots and failures.
- Deputies profile pages can title activity tabs as `Activitate parlamentară`;
  importer identity uses group-list names for member display names and profile
  pages for mandates, committees, groups, and party history.
- Chamber nominal vote links may be referenced from Senate legislative timeline,
  for example `cdep.ro/pls/steno/evot2015.Nominal?idv=35953`.
  The working 2024-present endpoint is the ORDS path
  `https://www.cdep.ro/ords/pls/steno/evot2015.Nominal?idv=<id>`, so legacy
  `/pls/steno` vote links are canonicalized before import.
- Chamber nominal vote pages can contain the full voted subject in a table row
  labelled `Subiect vot`, including the `PL-x` identifier and a project detail
  link. This must be parsed before broad backfill; otherwise the vote page may
  only show the generic HTML title `VOT ELECTRONIC`.
- Chamber electronic-vote days are discoverable from
  `evot2015.zile_vot?lu=<month>&an=<year>`, which returns compact `YYYYMMDD`
  values. Each day can then be fetched through
  `evot2015.data?dat=<YYYYMMDD>&cam=2&idl=1`, whose rows link nominal vote
  pages and often include adjacent bill/project title rows.
- Source discovery uses canonical official URLs and official identifiers where
  present, so legacy and ORDS variants of the same Chamber vote detail do not
  create duplicate queue entries.
- CDEP nominal vote URLs vary by case and language parameter, for example
  `evot2015.nominal?idv=<id>&idl=1`; canonical identity is
  `evot2015.Nominal?idv=<id>`.
- Some CDEP electronic vote pages are joint Chamber/Senate sittings, visible
  through a mixed `Parlamentar` column and chamber labels for both Camera
  Deputaților and Senat. The Deputies nominal vote importer intentionally skips
  these pages for now because the current domain model stores a vote under a
  single chamber. Keep their source snapshots inspectable and add a separate
  joint-vote model/parser before showing them as complete data.
- Chamber bill discovery targets official `upl_pck2015.proiect` detail URLs
  when they are exposed by list or timeline pages.
- Chamber displayed identifiers normalize to `PL-x <number>/<year>`, even when
  cross-linked Senate pages write them as compact `PLX<number>/<year>`.
- The intended Chamber project backbone is the official yearly list
  `upl_pck2015.lista?anp=<year>`, which exposes an official total such as 592
  records for 2025 in indexed copies. Direct requests from the current local
  runtime return `404`, so importer attempts store failed yearly-list snapshots
  for inspection instead of treating the source as empty.
- Direct fetches can be slower or flaky. Importers must retry, store failures,
  and keep the official URL as source metadata.
- 2026-05-16: first importer attempt against the legacy
  `http://www.cdep.ro/pls/steno/evot2015.Nominal?idv=35953` path failed
  gracefully. Retesting through the ORDS endpoint succeeded and the first
  repaired batch persisted 6 Deputies nominal votes.

## Government And Composition

- Constitutional frame:
  `https://www.cdep.ro/pls/legis/legis_pck.htp_act_text?idt=1253`
  - The President designates a candidate for Prime Minister.
  - The candidate asks Parliament for confidence on the program and full
    Government list.
  - The Government starts exercising the mandate after the oath.
  - The Government is politically accountable before Parliament.
- Portal Legislativ is the preferred source for decrees and official acts
  around designation, appointment, reshuffles, and minister changes. Example:
  `https://legislatie.just.ro/Public/DetaliiDocument/172817`
- The first post-1989 government timeline seed uses
  `https://en.wikipedia.org/wiki/List_of_heads_of_government_of_Romania` as a
  manual chronology backbone only. Rows imported from this seed must remain
  marked `manual_curation` / `skeleton manual` until each government/event is
  enriched with official source snapshots.
- CDEP/Senate joint sitting records are preferred for investiture votes,
  confidence votes, and no-confidence motions when nominal or result data is
  available.
- `gov.ro` can support current cabinet display, but historical composition
  should prefer official acts and Parliament records when available.

## Historical Rosters

- Wikipedia elected-list references for validation and planning only:
  - Current Chamber seat distribution:
    `https://ro.wikipedia.org/wiki/Camera_Deputa%C8%9Bilor_din_Rom%C3%A2nia`
  - Current Senate seat distribution:
    `https://ro.wikipedia.org/wiki/Senatul_Rom%C3%A2niei`
  - Legislatures and member list index for Senators:
    `https://ro.wikipedia.org/wiki/List%C4%83_de_senatori_rom%C3%A2ni`
  - Legislatures and member list index for Deputies:
    `https://ro.wikipedia.org/wiki/List%C4%83_de_deputa%C8%9Bi_rom%C3%A2ni`
  - 2020:
    `https://ro.wikipedia.org/wiki/Lista_parlamentarilor_ale%C8%99i_la_alegerile_din_Rom%C3%A2nia_din_2020`
  - 2016:
    `https://ro.wikipedia.org/wiki/Lista_parlamentarilor_ale%C8%99i_la_alegerile_din_Rom%C3%A2nia_din_2016`
  - 2012:
    `https://ro.wikipedia.org/wiki/Lista_parlamentarilor_ale%C8%99i_la_alegerile_din_Rom%C3%A2nia_din_2012`
  - 2008:
    `https://ro.wikipedia.org/wiki/Lista_parlamentarilor_ale%C8%99i_la_alegerile_din_Rom%C3%A2nia_din_2008`
  - The chamber index pages link legislature pages back to 1990:
    1990-1992, 1992-1996, 1996-2000, 2000-2004, 2004-2008,
    2008-2012, 2012-2016, 2016-2020, 2020-2024, and 2024-2028.
  - These pages are useful for expected elected-seat sanity checks. For example,
    the 2020 page states 330 Deputies and 136 Senators were elected. They are
    not official sources and should not replace Parliament pages or official
    electoral records.
- Deputies historical profiles:
  - Official member profiles are available through
    `https://www.cdep.ro/ords/pls/parlam/structura2015.mp?cam=2&idl=1&idm=<id>&leg=<year>&pag=1`.
  - Verified `leg` values so far:
    - `1990`
    - `1992`
    - `1996`
    - `2000`
    - `2004`
    - `2008`
    - `2020`
    - `2016`
    - `2012`
  - CDEP `idm` values are not globally stable across legislatures. They can be
    reused by different people in different legislatures, so historical
    Deputies member IDs must include the legislature year, e.g.
    `member-deputies-2020-93`. Current 2024 records keep
    `member-deputies-<idm>` for compatibility with imported nominal votes.
  - A controlled ID scan from `1` to `450` parsed 354 valid Deputies profiles.
  - A controlled ID scan from `1` to `450` parsed 361 valid Deputies profiles
    for 2016-2020.
  - A controlled ID scan from `1` to `650` parsed 417 valid Deputies profiles
    for 2012-2016.
  - A controlled ID scan from `1` to `650` parsed 339 valid Deputies profiles
    for 2008-2012.
  - A controlled ID scan from `1` to `650` parsed 378 valid Deputies profiles
    for 2004-2008.
  - A controlled ID scan from `1` to `750` parsed 393 valid Deputies profiles
    for 2000-2004.
  - A controlled ID scan from `1` to `750` parsed 367 valid Deputies profiles
    for 1996-2000.
  - A controlled ID scan from `1` to `750` parsed 381 valid Deputies profiles
    for 1992-1996.
  - A controlled ID scan from `1` to `750` parsed 448 valid Deputies profiles
    for 1990-1992.
  - Generic section pages such as `Activitate publică` can be returned for
    unused IDs and must be filtered before persistence.
  - The CDEP TLS chain can fail Node's default certificate verification. The
    importer keeps the normal verified fetch first, then uses a scoped
    certificate-validation fallback only for certificate failures.
  - Historical party/group parsing currently recognizes older parties such as
    ALDE, PMP, PDL, PD, PRM, PUR, PDSR, PSDR, FSN, FDSN, PNȚCD, PUNR,
    PDAR, PER, MER, PSM, PAC, PL '93, PP-DD, PC, UNPR, and PRO România.
    Only parties actually observed in parsed official rows are persisted by
    the roster import.
  - USL is intentionally not modelled as a party. It should be represented as a
    coalition/alignment period involving PSD and PNL when the composition
    alignment importer is added.
  - Other alliance labels such as PSD+PC and DA PNL-PD are also blocked from
    creating party rows until coalition/alliance modelling is introduced.
  - CDR and USD are also treated as coalition/alliance labels, not parties.
- Senate 2020-2024:
  - The current `EnumGrupuri.aspx` endpoint does not expose an obvious
    historical index for all 2020 groups.
  - Verified official group detail URLs imported the main 2020 groups:
    - PSD:
      `https://www.senat.ro/ComponentaGrupuri.aspx?GrupID=603B5FC4-8093-4EE7-A5EA-7779310901F0&Zi=`
    - PNL:
      `https://www.senat.ro/ComponentaGrupuri.aspx?GrupID=21eba8de-ecfd-4cc2-8db2-811825d75333&Zi=`
    - USR:
      `https://www.senat.ro/ComponentaGrupuri.aspx?GrupID=d50ad932-b344-4cf9-9d31-7dcb13137c81&Zi=`
    - AUR:
      `https://www.senat.ro/ComponentaGrupuri.aspx?GrupID=7E800D5F-E9DE-4645-918B-9CD7B29091C7&Zi=`
    - UDMR:
      `https://www.senat.ro/ComponentaGrupuri.aspx?GrupID=b8faa44f-07a0-4de5-bbc6-0618a4c0a194&Zi=`
  - Unaffiliated 2020 Senate members remain a known source-discovery gap.

Historical roster modelling rule:
- A legislature-bounded roster import can include every person who served at
  any point in the term, which is correct for Transfermarkt-style member
  history.
- A chamber composition for a specific day must use active mandate intervals.
  If a mandate has no explicit end date, the UI can bound it by the legislature
  end date, but replacements/resignations still need official dated exits
  before older compositions are exact.

Composition parser rules:
- Store official investiture/coalition data separately from computed governing
  support derived from voting behavior.
- Store a dated event whenever a government, minister, party/group alignment,
  mandate, or chamber composition changes.
- Do not infer opposition/governing status from party names alone. Unknown or
  unsupported alignments stay `unknown`.
- If a person appears across multiple source systems or legislatures, connect
  the records through a canonical `people` row while preserving the original
  chamber-specific `members` records and source IDs.

## Reliability Rules

- Store raw source URL, fetched timestamp, content hash, parser version, and
  parse status for every import.
- If a nominal vote has member rows but no voted-subject metadata, store it as
  partial with an inspectable warning instead of treating it as complete.
- Parser tests use saved fixtures so UI and parsing behavior do not depend on
  live network availability.
- Empty or inconsistent official values are stored as `unknown`, not guessed.
- URL fragments and in-page anchors are not treated as separate sources.
- Parliament structure/procedure explanations are tracked in
  `docs/parliament-how-it-works.md`; official procedure, group, committee, and
  constitutional pages take priority over Wikipedia overview text.

## Party Visual Identities

Goal:
- Show party visual cues on member history and composition pages without
  implying a current logo applies to a past legislature.

Preferred source order:
- Official electoral-sign material from BEC/AEP for the relevant election year
  or legislature period.
- Official party registration/electoral documents when they include a visual
  sign and date.
- Party website logos only as fallback evidence, time-scoped and clearly marked
  as non-electoral branding.

Modelling rule:
- Do not store one permanent `party.logo`.
- Store temporal visual identities with:
  - `party_id`;
  - `legislature_id` or election year;
  - `valid_from` / `valid_to` when known;
  - logo/sign asset URL or stored asset reference;
  - `source_snapshot_id`;
  - source type such as `electoral_sign`, `party_register`, or `party_site`;
  - verification status.

Open source-discovery task:
- Build a small official-source matrix for 2024, 2020, 2016, 2012, 2008, and
  2004 before importing visual identities broadly.

## Wikipedia Roster Cross-Checks

Use:
- Wikipedia can be used as a secondary cross-check and fallback seed when
  official historical pages are incomplete, slow, or hard to discover.
- Official CDEP/Senate pages remain canonical when available.
- Wikipedia-derived rows must not overwrite official rows without a visible
  provenance/verification state.

Commands:
- `npm run ingest:wikipedia:roster -- --legislature=2020 --no-files`
- `npm run ingest:wikipedia:roster-index -- --chamber=deputies --no-files`
- `npm run ingest:roster:crosscheck -- --legislature=2020 --no-files`
- `npm run ingest:wikipedia:roster:all -- --no-files`
- `npm run ingest:roster:crosscheck:all -- --no-files`
- `npm run ingest:wikipedia:roster:import -- --all --chamber=senate --skip-existing --persist --no-files`

Default roster URL policy:
- `2016-2020`, `2020-2024`, and `2024-2028`: use the combined Wikipedia
  election-list pages because they expose parseable Senate and Deputies tables.
- `1990-1992` through `2012-2016`: use split legislature pages for
  `Camera Deputaților` and `Senat`; the 2008/2012 election-list pages do not
  have the same stable combined table structure.

Current 2020 observations:
- The Wikipedia election page text says 330 Deputies and 136 Senators.
- The parsed Wikipedia tables currently expose 331 Deputies rows and 136
  Senate rows. Keep this discrepancy visible instead of slicing the list.
- Wikipedia keeps several 2020 USR PLUS elected members as `PLUS`; CDEP profile
  pages store them under `USR`. Treat those as party/source framing
  differences, not automatic errors.
- Wikipedia’s elected-list pages do not necessarily include every later
  replacement or mandate movement that official CDEP profile ranges expose.

All-legislature observations:
- Split legislature pages often list everyone who served during the term, not
  only the elected seats at the start of the legislature.
- Use fixed legislature seat counts for seat maps and composition rendering;
  use the larger split-page member lists for Transfermarkt-style parliamentary
  career history.
- The historical Senate fallback import currently uses Wikipedia rows only for
  legislatures where official Senate rosters are still missing. It must be
  treated as fallback/manual provenance until official source snapshots are
  attached.
- Several labels from Wikipedia are coalitions, electoral alliances, minority
  organizations, or non-affiliation states (`USL`, `ARD`, `PSD+PC`, `CDR`,
  `independent`, `neafiliat`) and should be modeled separately from political
  parties before any fallback import writes them to DB.
