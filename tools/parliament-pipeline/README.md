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
```

The same commands are available through the umbrella CLI:

```bash
npm run pipeline:parliament -- tribunal-registry fetch-index
npm run pipeline:parliament -- tribunal-registry parse-index
```

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
data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl
data/parliament-pipeline/tribunal-registry/reports/index-summary.md
```

This first Tribunal step parses index records and PDF links only. PDF download,
PDF text extraction, legal event extraction, and matching to app party/formation
IDs are later steps.

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
