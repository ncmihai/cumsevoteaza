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

## Chamber of Deputies

- Chamber nominal vote links may be referenced from Senate legislative timeline,
  for example `cdep.ro/pls/steno/evot2015.Nominal?idv=35953`.
- Direct fetches can be slower or flaky. Importers must retry, store failures,
  and keep the official URL as source metadata.
- 2026-05-16: first importer attempt against
  `http://www.cdep.ro/pls/steno/evot2015.Nominal?idv=35953` failed gracefully
  and wrote a local ignored failure snapshot under `data/imports/`.

## Reliability Rules

- Store raw source URL, fetched timestamp, content hash, parser version, and
  parse status for every import.
- Parser tests use saved fixtures so UI and parsing behavior do not depend on
  live network availability.
- Empty or inconsistent official values are stored as `unknown`, not guessed.
