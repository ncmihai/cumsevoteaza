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
- Source discovery uses canonical official URLs and official identifiers where
  present, so legacy and ORDS variants of the same Chamber vote detail do not
  create duplicate queue entries.
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

## Reliability Rules

- Store raw source URL, fetched timestamp, content hash, parser version, and
  parse status for every import.
- Parser tests use saved fixtures so UI and parsing behavior do not depend on
  live network availability.
- Empty or inconsistent official values are stored as `unknown`, not guessed.
- URL fragments and in-page anchors are not treated as separate sources.
- Parliament structure/procedure explanations are tracked in
  `docs/parliament-how-it-works.md`; official procedure, group, committee, and
  constitutional pages take priority over Wikipedia overview text.
