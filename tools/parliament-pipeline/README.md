# Parliament pipeline

Local-first Python data pipeline for `cumsevoteaza`.

The public website remains Next.js + Neon. This pipeline is for data
engineering work: fetching official pages, parsing difficult historical HTML,
writing raw snapshots, emitting normalized JSONL, and generating audit reports
before the TypeScript importer writes to Postgres.

## Principles

- Python is file-first.
- TypeScript remains the only canonical DB persistence layer.
- Big historical backfills run locally first.
- Every official fetch should produce raw snapshot metadata.
- Parser warnings should become inspectable files, not console-only notes.

## Commands

List implemented pipeline domains:

```bash
npm run pipeline:parliament -- domains
```

Print the historical member workflow:

```bash
npm run pipeline:parliament -- plan historical-members
```

Run the current CDEP member-history pipeline commands through the umbrella CLI:

```bash
npm run pipeline:parliament -- cdep-members roster-urls --legislature 2004 --chamber both

npm run pipeline:parliament -- cdep-members crawl \
  --legislature 2004 \
  --chamber both \
  --no-follow-careers \
  --insecure

npm run pipeline:parliament -- cdep-members audit --legislature 2004

npm run pipeline:parliament -- cdep-members preview-import

npm run pipeline:parliament -- cdep-members asset-inventory
```

Run the Tribunalul București legal registry index pipeline:

```bash
npm run pipeline:tribunal -- fetch-index
npm run pipeline:tribunal -- parse-index
npm run pipeline:tribunal -- fetch-pdfs --limit 20
npm run pipeline:tribunal -- parse-pdfs
npm run pipeline:tribunal -- match-app-entities
```

The same commands are available through the umbrella CLI:

```bash
npm run pipeline:parliament -- tribunal-registry fetch-index
npm run pipeline:parliament -- tribunal-registry parse-index
```

Run the Romanian Wikipedia party-history candidate pipeline:

```bash
npm run pipeline:parliament -- party-history fetch-wikipedia
npm run pipeline:parliament -- party-history parse-wikipedia
```

This generates candidate rows only. Review the report before promoting any
date or relationship into `data/curated/political-formation-events.json`.

The existing direct command stays supported:

```bash
npm run probe:cdep-history -- crawl --legislature 2004 --chamber both --no-follow-careers --insecure
```

## Output contract

Current CDEP member output remains:

```text
data/cdep-history/raw/
data/cdep-history/parsed/profiles.jsonl
data/cdep-history/parsed/profile-failures.jsonl
data/cdep-history/parsed/rosters.jsonl
data/cdep-history/reports/summary.json
data/cdep-history/reports/audit.json
data/cdep-history/parsed/import-preview.json
data/cdep-history/parsed/assets.jsonl
data/cdep-history/reports/assets.json
```

Tribunal registry index output is file-only:

```text
data/parliament-pipeline/tribunal-registry/raw/index-partide-politice.html
data/parliament-pipeline/tribunal-registry/raw/index-aliante-politice.html
data/parliament-pipeline/tribunal-registry/raw/index-alte-forme-de-asociere.html
data/parliament-pipeline/tribunal-registry/raw/pdfs/
data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl
data/parliament-pipeline/tribunal-registry/parsed/tribunal_pdf_metadata.jsonl
data/parliament-pipeline/tribunal-registry/parsed/tribunal_app_entity_matches.jsonl
data/parliament-pipeline/tribunal-registry/reports/index-summary.md
data/parliament-pipeline/tribunal-registry/reports/pdf-summary.md
data/parliament-pipeline/tribunal-registry/reports/match-review.md
```

The raw PDF directory is intentionally local-only under `data/parliament-pipeline/`,
which is ignored by git. The durable artifact is the parsed JSONL metadata.
If `pypdf` is installed locally, `parse-pdfs` also attempts text extraction;
otherwise it still records file size, hash, index metadata, and extracted dates
from the registry page text. Matching to app party/formation IDs remains a
file-only review step through `match-app-entities`. The matcher ranks Tribunal
records against `data/curated/political-entity-candidates.json` and writes both
machine-readable matches and a manual-review markdown report.

Wikipedia party-history output is also file-only:

```text
data/parliament-pipeline/party-history/raw/wikipedia/*.html
data/parliament-pipeline/party-history/parsed/wikipedia_party_history_candidates.jsonl
data/parliament-pipeline/party-history/reports/wikipedia-party-history-review.md
```

The source list lives in `data/curated/wikipedia-party-history-sources.json`.
Parser output is intentionally marked `needs_review`; it is a candidate
generator for Romanian Wikipedia infobox/history sentences, not a DB importer.

The TypeScript importer consumes these files and performs DB writes:

```bash
npm run ingest:cdep-history:import -- --legislature=2004
npm run ingest:cdep-history:import -- --legislature=2004 --persist
npm run ingest:assets:import -- --limit=10
npm run ingest:assets:import -- --asset-type=photo --legislature=2004 --limit=10 --persist
```

Run `--persist` against local Postgres first, verify counts, then apply to Neon.
Asset import also requires `BLOB_READ_WRITE_TOKEN`; without `--persist` it is a
selection dry-run and does not upload files or write `stored_assets`.
