# CDEP history probe

Experimental official-source crawler for Romanian Parliament member careers.

This probe is intentionally file-first. It does not write to Postgres. Use it
to fetch and inspect CDEP roster/profile data before changing the canonical
importers.

## Why one script is enough

CDEP profile pages expose `Activitate parlamentara` links for the same person
across legislatures and chambers. The crawler treats those links as graph edges
and dedupes profiles by:

```text
leg + cam + idm
```

So a multi-legislature person does not need a second script. Seed one known
profile or a whole roster, and the crawler can follow the official career links.

## Examples

Fetch every person listed for one chamber/legislature and also follow each
person's official career links:

```bash
npm run probe:cdep-history -- crawl \
  --legislature 2004 \
  --chamber deputies \
  --insecure
```

Fetch only the people in that chamber/legislature, without expanding to their
other mandates:

```bash
npm run probe:cdep-history -- crawl \
  --legislature 2004 \
  --chamber deputies \
  --no-follow-careers \
  --insecure
```

For the base roster, avoid `--include-reelected`. The `par=X` page is useful
for cross-checking, but it lists people elected in other legislatures and can
inflate the discovery queue. The reliable base for a chamber/legislature is the
plain `structura.de?leg=<year>` page, with `cam=1` for Senate.

Probe one known multi-legislature profile and follow its career links:

```bash
npm run probe:cdep-history -- crawl \
  --seed-url "https://cdep.ro/ords/pls/parlam/structura.mp?idm=280&cam=2&leg=2000&pag=1&idl=1" \
  --limit-profiles 25 \
  --insecure
```

Probe a small 2004 roster sample:

```bash
npm run probe:cdep-history -- crawl \
  --legislature 2004 \
  --chamber both \
  --include-reelected \
  --limit-profiles 50 \
  --insecure
```

`--insecure` is explicit because CDEP's TLS chain can fail with Python's local
certificate store. The generated snapshot metadata records when TLS
verification was disabled.

Dry-run official roster URLs:

```bash
npm run probe:cdep-history -- roster-urls --legislature all
```

Generate an audit report from the latest parsed files:

```bash
npm run probe:cdep-history -- audit --legislature 2004
```

The audit can compare probe counts with Postgres when `DATABASE_URL` is set and
either `psql` or the repo's Node `postgres` dependency is available. It never
writes to the database.

Build a normalized file-only import preview:

```bash
npm run probe:cdep-history -- preview-import
```

The preview groups official profile rows into person candidates by following
CDEP career-link graph edges. It also lists missing career profile keys that
can be fetched in a later expansion pass.

Convert the latest parsed profiles into the app's roster import shape without
writing to Postgres:

```bash
npm run ingest:cdep-history:import -- --legislature=2004
```

When the import preview finds records that need manual review, it writes both
JSON and CSV review files. For example:

```text
data/cdep-history/reports/manual-warning-review-2004-2008.json
data/cdep-history/reports/manual-warning-review-2004-2008.csv
```

The importer is dry-run by default. When local Postgres is running and the
dry-run counts are acceptable, apply the same rows to the target database with:

```bash
npm run ingest:cdep-history:import -- --legislature=2004 --persist
```

Do this against Docker/local first. The importer reuses the existing
`persistRoster` path and writes official CDEP member ids such as
`member-deputies-2004-1`, so it can coexist with older Wikipedia-derived rows
until those are intentionally retired.

## Output

Generated files are ignored by git:

```text
data/cdep-history/raw/
data/cdep-history/parsed/profiles.jsonl
data/cdep-history/parsed/profile-failures.jsonl
data/cdep-history/parsed/rosters.jsonl
data/cdep-history/reports/summary.json
data/cdep-history/reports/audit.json
data/cdep-history/parsed/import-preview.json
```

Keep this probe separate until the parsed output is audited against known
problem cases.
