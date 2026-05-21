#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
CDEP_PROBE_PATH = REPO_ROOT / "tools" / "cdep-history-probe" / "cdep_history_probe.py"


DOMAINS = [
    {
        "name": "cdep-members",
        "status": "implemented",
        "purpose": "Official CDEP-hosted post-1989 member roster/profile history.",
        "outputs": [
            "data/cdep-history/raw/",
            "data/cdep-history/parsed/profiles.jsonl",
            "data/cdep-history/parsed/rosters.jsonl",
            "data/cdep-history/reports/audit.json",
            "data/cdep-history/parsed/import-preview.json",
            "data/cdep-history/parsed/assets.jsonl",
            "data/cdep-history/reports/assets.json",
        ],
        "dbWriter": "npm run ingest:cdep-history:import -- --legislature=<year>",
    },
    {
        "name": "votes-projects",
        "status": "planned",
        "purpose": "Official vote/project discovery, parser diagnostics, and partial-data reports.",
        "outputs": [
            "data/parliament-pipeline/votes-projects/raw/",
            "data/parliament-pipeline/votes-projects/parsed/*.jsonl",
            "data/parliament-pipeline/votes-projects/reports/*.json",
        ],
        "dbWriter": "Existing TypeScript discovery/import commands",
    },
]


HISTORICAL_MEMBERS_PLAN = {
    "title": "Historical members pipeline",
    "steps": [
        "Generate official CDEP roster URLs for each legislature/chamber.",
        "Crawl a legislature/chamber batch locally and save raw HTML snapshots.",
        "Parse profiles into normalized JSONL with parties, groups, committees, career links, replacements, photos, and logos.",
        "Run audit to compare expected official counts, missing fields, duplicate names, and Postgres counts where DATABASE_URL is available.",
        "Generate import preview and manual-review files.",
        "Run the TypeScript importer in dry-run mode.",
        "Persist to local Postgres, verify counts and sample profiles.",
        "Persist to Neon only after local verification.",
    ],
    "currentDbBoundary": "Python writes JSON/JSONL only; TypeScript writes Postgres.",
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Local-first Python data pipeline for cumsevoteaza official-source ingestion."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("domains", help="List pipeline domains and DB write boundaries.")

    plan = sub.add_parser("plan", help="Print a pipeline workflow plan.")
    plan.add_argument("workflow", choices=["historical-members"])

    cdep = sub.add_parser("cdep-members", help="Run CDEP member-history pipeline commands.")
    cdep_sub = cdep.add_subparsers(dest="cdep_command", required=True)
    add_cdep_roster_urls(cdep_sub)
    add_cdep_crawl(cdep_sub)
    add_cdep_audit(cdep_sub)
    add_cdep_preview(cdep_sub)
    add_cdep_asset_inventory(cdep_sub)

    args = parser.parse_args()
    if args.command == "domains":
        print_json({"domains": DOMAINS})
        return
    if args.command == "plan":
        print_json(HISTORICAL_MEMBERS_PLAN)
        return
    if args.command == "cdep-members":
        run_cdep_command(args)
        return


def add_cdep_roster_urls(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("roster-urls", help="Print official CDEP roster URLs.")
    parser.add_argument("--legislature", default="all", help="One start year or all.")
    parser.add_argument("--chamber", default="both", choices=["both", "deputies", "senate"])
    parser.add_argument("--include-reelected", action="store_true")


def add_cdep_crawl(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("crawl", help="Fetch CDEP rosters/profiles and write parsed JSONL.")
    parser.add_argument("--seed-url", action="append", default=[], help="Seed structura.mp profile URL. Can be repeated.")
    parser.add_argument("--legislature", default=None, help="Roster start year or all.")
    parser.add_argument("--chamber", default="both", choices=["both", "deputies", "senate"])
    parser.add_argument("--include-reelected", action="store_true")
    parser.add_argument("--follow-careers", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--limit-profiles", type=int, default=0, help="Stop after N unique profiles. 0 means no limit.")
    parser.add_argument("--out", type=Path, default=Path("data/cdep-history"))
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between live fetches.")
    parser.add_argument("--concurrency", type=int, default=1, help="Concurrent profile fetches. Keep low for official sites.")
    parser.add_argument("--refresh", action="store_true", help="Refetch even when a raw snapshot exists.")
    parser.add_argument("--insecure", action="store_true", help="Disable TLS verification for CDEP probe fetches.")


def add_cdep_audit(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("audit", help="Summarize parsed CDEP JSONL and optionally compare counts with Postgres.")
    parser.add_argument("--profiles", type=Path, default=Path("data/cdep-history/parsed/profiles.jsonl"))
    parser.add_argument("--rosters", type=Path, default=Path("data/cdep-history/parsed/rosters.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("data/cdep-history/reports/audit.json"))
    parser.add_argument("--legislature", default="2004", help="Legislature start year for DB comparison.")
    parser.add_argument("--database-url", default=None, help="Postgres URL. Defaults to DATABASE_URL or .env.")


def add_cdep_preview(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("preview-import", help="Build a file-only normalized import preview from parsed profiles.")
    parser.add_argument("--profiles", type=Path, default=Path("data/cdep-history/parsed/profiles.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("data/cdep-history/parsed/import-preview.json"))


def add_cdep_asset_inventory(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("asset-inventory", help="Build a file-only inventory of official profile assets.")
    parser.add_argument("--profiles", type=Path, default=Path("data/cdep-history/parsed/profiles.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("data/cdep-history/parsed/assets.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("data/cdep-history/reports/assets.json"))


def run_cdep_command(args: argparse.Namespace) -> None:
    cdep = load_cdep_probe()
    if args.cdep_command == "roster-urls":
        for item in cdep.roster_urls(args.legislature, args.chamber, args.include_reelected):
            print(item["url"])
        return
    if args.cdep_command == "crawl":
        cdep.run_crawl(args)
        return
    if args.cdep_command == "audit":
        cdep.run_audit(args)
        return
    if args.cdep_command == "preview-import":
        cdep.run_preview_import(args)
        return
    if args.cdep_command == "asset-inventory":
        cdep.run_asset_inventory(args)
        return
    raise SystemExit(f"Unsupported CDEP command: {args.cdep_command}")


def load_cdep_probe() -> Any:
    spec = importlib.util.spec_from_file_location("cdep_history_probe", CDEP_PROBE_PATH)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Cannot load CDEP probe module from {CDEP_PROBE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def print_json(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
