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
```

The TypeScript importer consumes these files and performs DB writes:

```bash
npm run ingest:cdep-history:import -- --legislature=2004
npm run ingest:cdep-history:import -- --legislature=2004 --persist
```

Run `--persist` against local Postgres first, verify counts, then apply to Neon.
