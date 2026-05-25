# CDEP Access Method

The official CDEP site is treated as a fragile source. It may time out or drop
traffic for an entire shared public IP, especially on dorm, office, or other
NAT-heavy networks.

## Current Observation

On 2026-05-22:

- `cdep.ro` loaded from the user's phone on mobile data.
- The same URLs timed out from the phone on dorm Wi-Fi.
- The same URLs timed out from the desktop on dorm Wi-Fi.
- `http`, `https`, `cdep.ro`, and `www.cdep.ro` all timed out from the desktop.

This points to a network/IP route block or drop for the dorm Wi-Fi public IP,
not a browser-specific issue and not a general CDEP outage.

## Operating Rules

- Do not run broad CDEP crawls from dorm Wi-Fi.
- Prefer cached raw snapshots and local parsing whenever possible.
- Run CDEP live fetches only from a connection that passes a single-profile
  smoke check first.
- Keep live CDEP jobs resumable and easy to stop.
- Use one chamber and one legislature per batch.
- Use low concurrency: `--concurrency 1`.
- Use a high delay: `--delay 2` or slower.
- Avoid `--refresh` unless the specific raw snapshot must be replaced.
- Stop immediately if timeouts increase.

## Hotspot Crawl Shape

Before crawling:

```bash
curl -I -L --max-time 20 'https://cdep.ro/ords/pls/parlam/structura.mp?idm=64&cam=2&leg=2004&pag=1&idl=1'
```

If the smoke check succeeds, start with a small batch:

```bash
npm run pipeline -- cdep-members crawl \
  --legislature 2004 \
  --chamber deputies \
  --follow-careers \
  --limit-profiles 25 \
  --delay 2 \
  --concurrency 1
```

Then continue one controlled batch at a time:

```bash
npm run pipeline -- cdep-members crawl \
  --legislature 2004 \
  --chamber deputies \
  --follow-careers \
  --delay 2 \
  --concurrency 1
```

After crawling, disconnect from the hotspot and do the rest locally:

```bash
npm run pipeline:parliament -- cdep-members audit --legislature 2004
npm run pipeline:parliament -- cdep-members preview-import
```

## Asset Backup Shape

CDEP profile images are backed up only after an asset inventory has been
generated from cached profile snapshots:

```bash
npm run pipeline:parliament -- cdep-members asset-inventory
```

Priority order:

1. Historical party logos. These are reused heavily by the Transfermarkt-style
   member history and have only a small number of unique official URLs.
2. Current-legislature member photos (`2024-2028`) for both chambers.
3. One latest known CDEP photo for historical-only people.
4. Optional full per-legislature photo history.

Use resumable unique-URL batches for live CDEP asset fetches:

```bash
npm run ingest:assets:import -- \
  --asset-type=party_logo \
  --max-unique-official-urls=10 \
  --unique-official-url-offset=0 \
  --delay-ms=2000 \
  --timeout-ms=20000 \
  --insecure \
  --persist
```

For current member photos, keep smaller batches:

```bash
npm run ingest:assets:import -- \
  --asset-type=photo \
  --legislature=2024 \
  --max-unique-official-urls=50 \
  --unique-official-url-offset=125 \
  --delay-ms=2000 \
  --timeout-ms=20000 \
  --insecure \
  --persist
```

For historical-only members, first generate a smaller file-only import list:

```bash
npm run pipeline:parliament -- cdep-members latest-historical-photos
```

Then import that generated file in the same cautious batch shape:

```bash
npm run ingest:assets:import -- \
  --assets=data/cdep-history/parsed/latest-historical-photos.jsonl \
  --asset-type=photo \
  --max-unique-official-urls=50 \
  --unique-official-url-offset=0 \
  --delay-ms=2000 \
  --timeout-ms=20000 \
  --insecure \
  --persist
```

## Rationale

The project needs durable official-source data, but it must not hammer official
sites. The safe pattern is fetch once, cache raw snapshots, parse locally, audit
locally, then persist through the TypeScript import path only after review.
