#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from dataclasses import dataclass, field
from html.parser import HTMLParser
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[2]
CDEP_PROBE_PATH = REPO_ROOT / "tools" / "cdep-history-probe" / "cdep_history_probe.py"
TRIBUNAL_BASE_URL = "https://tribunalulbucuresti.ro"
TRIBUNAL_INDEXES = [
    {
        "kind": "party",
        "slug": "partide-politice",
        "url": f"{TRIBUNAL_BASE_URL}/index.php/partide-si-aliante-politice/partide-politice",
        "pdfPathMarker": "/politice-partide/",
    },
    {
        "kind": "alliance",
        "slug": "aliante-politice",
        "url": f"{TRIBUNAL_BASE_URL}/index.php/partide-si-aliante-politice/aliante-politice",
        "pdfPathMarker": "/politice-aliante/",
    },
    {
        "kind": "other_association",
        "slug": "alte-forme-de-asociere",
        "url": f"{TRIBUNAL_BASE_URL}/index.php/partide-si-aliante-politice/alte-forme-de-asociere-ale-partidelor",
        "pdfPathMarker": "/politice-alte/",
    },
]

WIKIPEDIA_HISTORY_KEYWORDS = [
    "fondat",
    "fondată",
    "înființat",
    "înființată",
    "reînființat",
    "reînființată",
    "fuzionat",
    "fuzionat cu",
    "absorbit",
    "absorbită",
    "alianță",
    "alianţa",
    "dizolvat",
    "dizolvată",
    "scindat",
    "desprins",
    "redenumit",
    "redenumită",
]

ROMANIAN_MONTHS = {
    "ianuarie": "01",
    "februarie": "02",
    "martie": "03",
    "aprilie": "04",
    "mai": "05",
    "iunie": "06",
    "iulie": "07",
    "august": "08",
    "septembrie": "09",
    "octombrie": "10",
    "noiembrie": "11",
    "decembrie": "12",
}


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
    {
        "name": "tribunal-registry",
        "status": "implemented-index",
        "purpose": "Tribunalul București legal party/alliance registry index snapshots and parsed PDF link records.",
        "outputs": [
            "data/parliament-pipeline/tribunal-registry/raw/index-*.html",
            "data/parliament-pipeline/tribunal-registry/raw/pdfs/*.pdf",
            "data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl",
            "data/parliament-pipeline/tribunal-registry/parsed/tribunal_pdf_metadata.jsonl",
            "data/parliament-pipeline/tribunal-registry/parsed/tribunal_app_entity_matches.jsonl",
            "data/parliament-pipeline/tribunal-registry/reports/index-summary.md",
            "data/parliament-pipeline/tribunal-registry/reports/pdf-summary.md",
            "data/parliament-pipeline/tribunal-registry/reports/match-review.md",
        ],
        "dbWriter": "None yet; Python writes files only.",
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

    tribunal = sub.add_parser("tribunal-registry", help="Run Tribunalul București legal registry pipeline commands.")
    tribunal_sub = tribunal.add_subparsers(dest="tribunal_command", required=True)
    add_tribunal_fetch_index(tribunal_sub)
    add_tribunal_parse_index(tribunal_sub)
    add_tribunal_fetch_pdfs(tribunal_sub)
    add_tribunal_parse_pdfs(tribunal_sub)
    add_tribunal_match_app_entities(tribunal_sub)

    party_history = sub.add_parser("party-history", help="Run file-first party/alliance history candidate extraction.")
    party_history_sub = party_history.add_subparsers(dest="party_history_command", required=True)
    add_party_history_fetch_wikipedia(party_history_sub)
    add_party_history_parse_wikipedia(party_history_sub)

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
    if args.command == "tribunal-registry":
        run_tribunal_command(args)
        return
    if args.command == "party-history":
        run_party_history_command(args)
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

    latest = sub.add_parser("latest-historical-photos", help="Build an import inventory with one latest CDEP photo per historical-only person.")
    latest.add_argument("--assets", type=Path, default=Path("data/cdep-history/parsed/assets.jsonl"))
    latest.add_argument("--current-legislature", default="leg-2024-2028")
    latest.add_argument("--out", type=Path, default=Path("data/cdep-history/parsed/latest-historical-photos.jsonl"))


def add_tribunal_fetch_index(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("fetch-index", help="Fetch Tribunalul București party/alliance index HTML snapshots.")
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/raw"))
    parser.add_argument("--refresh", action="store_true", help="Refetch even when the raw index file already exists.")


def add_tribunal_parse_index(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("parse-index", help="Parse Tribunalul București index snapshots into JSONL records.")
    parser.add_argument("--raw", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/raw"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/reports/index-summary.md"))


def add_tribunal_fetch_pdfs(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("fetch-pdfs", help="Download Tribunal registry PDFs referenced by parsed index records.")
    parser.add_argument("--entities", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/raw/pdfs"))
    parser.add_argument("--kind", choices=["all", "party", "alliance", "other_association"], default="all")
    parser.add_argument("--position", action="append", type=int, default=[], help="Registry position to fetch. Can be repeated.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum records to fetch after filters. 0 means all.")
    parser.add_argument("--refresh", action="store_true", help="Refetch even when a PDF exists.")


def add_tribunal_parse_pdfs(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("parse-pdfs", help="Parse downloaded Tribunal PDFs and index text into JSONL metadata.")
    parser.add_argument("--entities", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_entities.jsonl"))
    parser.add_argument("--pdf-dir", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/raw/pdfs"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_pdf_metadata.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/reports/pdf-summary.md"))


def add_tribunal_match_app_entities(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("match-app-entities", help="Match Tribunal rows against app party/formation candidates.")
    parser.add_argument("--tribunal", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_pdf_metadata.jsonl"))
    parser.add_argument("--candidates", type=Path, default=Path("data/curated/political-entity-candidates.json"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/parsed/tribunal_app_entity_matches.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("data/parliament-pipeline/tribunal-registry/reports/match-review.md"))


def add_party_history_fetch_wikipedia(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("fetch-wikipedia", help="Fetch curated Romanian Wikipedia party/alliance source pages.")
    parser.add_argument("--sources", type=Path, default=Path("data/curated/wikipedia-party-history-sources.json"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/party-history/raw/wikipedia"))
    parser.add_argument("--refresh", action="store_true", help="Refetch even when the raw HTML file exists.")


def add_party_history_parse_wikipedia(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("parse-wikipedia", help="Parse Wikipedia HTML snapshots into review-only candidate rows.")
    parser.add_argument("--sources", type=Path, default=Path("data/curated/wikipedia-party-history-sources.json"))
    parser.add_argument("--raw", type=Path, default=Path("data/parliament-pipeline/party-history/raw/wikipedia"))
    parser.add_argument("--out", type=Path, default=Path("data/parliament-pipeline/party-history/parsed/wikipedia_party_history_candidates.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("data/parliament-pipeline/party-history/reports/wikipedia-party-history-review.md"))


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
    if args.cdep_command == "latest-historical-photos":
        rows = select_latest_historical_photos(read_jsonl(args.assets), args.current_legislature)
        write_jsonl(rows, args.out)
        print_json({"selected": len(rows), "out": str(args.out), "currentLegislature": args.current_legislature})
        return
    raise SystemExit(f"Unsupported CDEP command: {args.cdep_command}")


def run_tribunal_command(args: argparse.Namespace) -> None:
    if args.tribunal_command == "fetch-index":
        summary = fetch_tribunal_indexes(args.out, refresh=args.refresh)
        print_json(summary)
        return
    if args.tribunal_command == "parse-index":
        records = parse_tribunal_index_dir(args.raw)
        write_tribunal_records(records, args.out)
        write_tribunal_report(records, args.report)
        print_json({"records": len(records), "out": str(args.out), "report": str(args.report), "byKind": count_by(records, "kind")})
        return
    if args.tribunal_command == "fetch-pdfs":
        records = filtered_tribunal_records(read_jsonl(args.entities), args.kind, args.position, args.limit)
        summary = fetch_tribunal_pdfs(records, args.out, refresh=args.refresh)
        print_json(summary)
        return
    if args.tribunal_command == "parse-pdfs":
        entities = read_jsonl(args.entities)
        rows = parse_tribunal_pdfs(entities, args.pdf_dir)
        write_jsonl(rows, args.out)
        write_tribunal_pdf_report(rows, args.report)
        print_json({"records": len(rows), "out": str(args.out), "report": str(args.report), "byStatus": count_by(rows, "pdfStatus")})
        return
    if args.tribunal_command == "match-app-entities":
        rows = match_tribunal_app_entities(read_jsonl(args.tribunal), read_json(args.candidates))
        write_jsonl(rows, args.out)
        write_tribunal_match_report(rows, args.report)
        print_json({"records": len(rows), "out": str(args.out), "report": str(args.report), "byStatus": count_by(rows, "matchStatus")})
        return
    raise SystemExit(f"Unsupported Tribunal command: {args.tribunal_command}")


def run_party_history_command(args: argparse.Namespace) -> None:
    if args.party_history_command == "fetch-wikipedia":
        sources = read_json(args.sources)
        summary = fetch_wikipedia_party_history_sources(sources, args.out, refresh=args.refresh)
        print_json(summary)
        return
    if args.party_history_command == "parse-wikipedia":
        sources = read_json(args.sources)
        rows = parse_wikipedia_party_history_sources(sources, args.raw)
        write_jsonl(rows, args.out)
        write_wikipedia_party_history_report(rows, args.report)
        print_json({"records": len(rows), "out": str(args.out), "report": str(args.report), "byEntity": count_by(rows, "entityId")})
        return
    raise SystemExit(f"Unsupported party-history command: {args.party_history_command}")


def fetch_wikipedia_party_history_sources(sources: list[dict[str, Any]], out: Path, refresh: bool = False) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()
    results = []
    for source in sources:
        path = wikipedia_source_path(out, source)
        if path.exists() and not refresh:
            status = "cached"
        else:
            html = fetch_text(source["url"])
            path.write_text(html, encoding="utf-8")
            status = "fetched"
        results.append({"entityId": source["entityId"], "label": source["label"], "url": source["url"], "path": str(path), "status": status})
    return {"fetchedAt": fetched_at, "records": len(sources), "byStatus": count_by(results, "status"), "results": results}


def parse_wikipedia_party_history_sources(sources: list[dict[str, Any]], raw: Path) -> list[dict[str, Any]]:
    parsed_at = datetime.now(timezone.utc).isoformat()
    rows: list[dict[str, Any]] = []
    for source in sources:
        path = wikipedia_source_path(raw, source)
        if not path.exists():
            rows.append(wikipedia_missing_row(source, path, parsed_at))
            continue
        html = path.read_text(encoding="utf-8")
        rows.extend(parse_wikipedia_party_history_html(html, source, parsed_at))
    return sorted(rows, key=lambda row: (row["entityId"], row.get("candidateDate") or "9999-99-99", row["candidateType"], row["id"]))


def parse_wikipedia_party_history_html(html: str, source: dict[str, Any], parsed_at: str | None = None) -> list[dict[str, Any]]:
    parser = WikipediaArticleParser()
    parser.feed(html)
    parsed_at = parsed_at or datetime.now(timezone.utc).isoformat()
    text_blocks = [
        ("infobox", text)
        for text in parser.infobox_lines
        if text
    ] + [
        ("paragraph", text)
        for paragraph in parser.paragraphs
        for text in split_sentences(paragraph)
        if text
    ]
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, (block_kind, text) in enumerate(text_blocks):
        if not is_history_candidate_text(text):
            continue
        dates = extract_romanian_date_candidates(text)
        event_hint = event_hint_from_text(text)
        key = f"{block_kind}|{event_hint}|{text}"
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "id": f"wiki-history-{stable_slug(source['entityId'])}-{stable_slug(event_hint)}-{index}",
                "entityId": source["entityId"],
                "entityType": source.get("entityType", "party"),
                "label": source["label"],
                "sourceKind": "wikipedia",
                "sourceUrl": source["url"],
                "sourceLanguage": "ro",
                "candidateType": block_kind,
                "eventHint": event_hint,
                "candidateDate": dates[0] if dates else None,
                "dateCandidates": dates,
                "text": text,
                "confidence": "medium" if dates and block_kind == "infobox" else "low" if not dates else "medium",
                "reviewStatus": "needs_review",
                "parsedAt": parsed_at,
            }
        )
    if not rows:
        return [wikipedia_no_candidates_row(source, parsed_at)]
    return rows


def write_wikipedia_party_history_report(rows: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Romanian Wikipedia Party History Candidate Review",
        "",
        "This is a candidate report only. Do not import rows directly into the database.",
        "Review dates, wording, and source context before promoting anything to `data/curated/political-formation-events.json`.",
        "",
        "## Counts",
        "",
    ]
    for status, count in sorted(count_by(rows, "reviewStatus").items()):
        lines.append(f"- `{status}`: {count}")
    lines.extend(["", "## Candidates", ""])
    for row in rows:
        date = row.get("candidateDate") or "-"
        lines.append(f"- `{row['entityId']}` · `{row.get('eventHint')}` · `{date}` · {row.get('text')}")
        lines.append(f"  Source: {row.get('sourceUrl')}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def wikipedia_source_path(out: Path, source: dict[str, Any]) -> Path:
    parsed = urlparse(source["url"])
    page_slug = stable_slug(unquote(Path(parsed.path).name) or source["label"])
    return out / f"{stable_slug(source['entityId'])}-{page_slug}.html"


def wikipedia_missing_row(source: dict[str, Any], path: Path, parsed_at: str) -> dict[str, Any]:
    return {
        "id": f"wiki-history-{stable_slug(source['entityId'])}-missing",
        "entityId": source["entityId"],
        "entityType": source.get("entityType", "party"),
        "label": source["label"],
        "sourceKind": "wikipedia",
        "sourceUrl": source["url"],
        "candidateType": "missing_snapshot",
        "eventHint": "missing_snapshot",
        "candidateDate": None,
        "dateCandidates": [],
        "text": f"Missing raw HTML snapshot: {path}",
        "confidence": "none",
        "reviewStatus": "missing_snapshot",
        "parsedAt": parsed_at,
    }


def wikipedia_no_candidates_row(source: dict[str, Any], parsed_at: str) -> dict[str, Any]:
    return {
        "id": f"wiki-history-{stable_slug(source['entityId'])}-no-candidates",
        "entityId": source["entityId"],
        "entityType": source.get("entityType", "party"),
        "label": source["label"],
        "sourceKind": "wikipedia",
        "sourceUrl": source["url"],
        "candidateType": "no_candidate",
        "eventHint": "no_candidate",
        "candidateDate": None,
        "dateCandidates": [],
        "text": "No history candidate sentence matched the current parser keywords.",
        "confidence": "none",
        "reviewStatus": "needs_review",
        "parsedAt": parsed_at,
    }


def fetch_tribunal_indexes(out: Path, refresh: bool = False) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()
    results = []
    for index in TRIBUNAL_INDEXES:
        path = out / f"index-{index['slug']}.html"
        if path.exists() and not refresh:
            status = "cached"
        else:
            html = fetch_text(index["url"])
            path.write_text(html, encoding="utf-8")
            status = "fetched"
        results.append({"kind": index["kind"], "url": index["url"], "path": str(path), "status": status})
    return {"fetchedAt": fetched_at, "indexes": results}


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "cumsevoteaza local research pipeline/0.1"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "cumsevoteaza local research pipeline/0.1"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def parse_tribunal_index_dir(raw: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for index in TRIBUNAL_INDEXES:
        path = raw / f"index-{index['slug']}.html"
        if not path.exists():
            raise SystemExit(f"Missing Tribunal index snapshot: {path}. Run fetch-index first.")
        html = path.read_text(encoding="utf-8")
        records.extend(parse_tribunal_index_html(html, index))
    return sorted(records, key=lambda item: (item["kind"], item.get("position") or 999999, item["legalName"]))


def parse_tribunal_index_html(html: str, index: dict[str, str]) -> list[dict[str, Any]]:
    parser = TribunalParagraphParser()
    parser.feed(html)
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for paragraph in parser.paragraphs:
        for link in paragraph.links:
            href = link["href"]
            if index["pdfPathMarker"] not in href:
                continue
            source_url = urljoin(TRIBUNAL_BASE_URL, href)
            if source_url in seen:
                continue
            seen.add(source_url)
            text = clean_text(link["text"])
            paragraph_text = clean_text(paragraph.text)
            position = extract_position(text)
            legal_name = extract_legal_name(text)
            short_name = extract_short_name(text, paragraph_text)
            listed_date = extract_leading_date(text)
            records.append(
                {
                    "id": f"tribunal-{index['kind']}-{position or stable_slug(legal_name)}",
                    "kind": index["kind"],
                    "position": position,
                    "listedDate": listed_date,
                    "legalName": legal_name,
                    "shortName": short_name,
                    "normalizedName": normalize_romanian_text(legal_name),
                    "normalizedShortName": normalize_romanian_text(short_name) if short_name else None,
                    "sourceUrl": source_url,
                    "sourcePath": href,
                    "rawLinkText": text,
                    "rawParagraphText": paragraph_text,
                }
            )
    return records


def write_tribunal_records(records: list[dict[str, Any]], out: Path) -> None:
    write_jsonl(records, out)


def write_jsonl(records: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def write_tribunal_report(records: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    by_kind = count_by(records, "kind")
    lines = [
        "# Tribunalul București Registry Index Summary",
        "",
        "File-first parser output for legal political entities. No database writes are performed.",
        "",
        "## Counts",
        "",
    ]
    for kind in ["party", "alliance", "other_association"]:
        lines.append(f"- `{kind}`: {by_kind.get(kind, 0)}")
    lines.extend(["", "## Sample Records", ""])
    for record in records[:20]:
        short = f" / `{record['shortName']}`" if record.get("shortName") else ""
        lines.append(f"- `{record['kind']}` #{record.get('position')}: {record['legalName']}{short}")
    lines.extend(["", "## Next Parser Step", ""])
    lines.append("Download selected PDFs, extract court file metadata, and match records against curated app party/formation IDs.")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def count_by(records: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for record in records:
        value = str(record.get(key))
        counts[value] = counts.get(value, 0) + 1
    return counts


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise SystemExit(f"Missing JSONL file: {path}")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def read_json(path: Path) -> Any:
    if not path.exists():
        raise SystemExit(f"Missing JSON file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def select_latest_historical_photos(records: list[dict[str, Any]], current_legislature: str) -> list[dict[str, Any]]:
    photos = [record for record in records if record.get("assetType") == "photo" and record.get("officialUrl")]
    current_people = {
        person_asset_key(record)
        for record in photos
        if record.get("legislatureId") == current_legislature or record.get("legislature") == current_legislature.removeprefix("leg-").split("-")[0]
    }
    latest_by_person: dict[str, dict[str, Any]] = {}
    for record in photos:
        key = person_asset_key(record)
        if key in current_people:
            continue
        current = latest_by_person.get(key)
        if current is None or photo_sort_key(record) > photo_sort_key(current):
            latest_by_person[key] = record
    return sorted(latest_by_person.values(), key=lambda row: (str(row.get("name") or ""), str(row.get("memberId") or row.get("entityId") or "")))


def person_asset_key(record: dict[str, Any]) -> str:
    return str(record.get("personKey") or record.get("memberId") or record.get("entityId") or record.get("id"))


def photo_sort_key(record: dict[str, Any]) -> tuple[int, str, str]:
    legislature = str(record.get("legislature") or "")
    match = re.search(r"\d{4}", legislature)
    year = int(match.group(0)) if match else 0
    fetched_at = str(record.get("sourceSnapshotFetchedAt") or "")
    profile_key = str(record.get("profileKey") or record.get("id") or "")
    return (year, fetched_at, profile_key)


def filtered_tribunal_records(records: list[dict[str, Any]], kind: str, positions: list[int], limit: int) -> list[dict[str, Any]]:
    filtered = [
        record for record in records
        if (kind == "all" or record.get("kind") == kind)
        and (not positions or record.get("position") in positions)
    ]
    return filtered[:limit] if limit > 0 else filtered


def fetch_tribunal_pdfs(records: list[dict[str, Any]], out: Path, refresh: bool = False) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()
    results = []
    for record in records:
        path = tribunal_pdf_path(out, record)
        if path.exists() and not refresh:
            status = "cached"
        else:
            try:
                pdf = fetch_bytes(record["sourceUrl"])
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(pdf)
                status = "fetched"
            except Exception as error:  # noqa: BLE001 - report per-record fetch failures.
                results.append({**pdf_result_base(record, path), "status": "failed", "error": str(error)})
                continue
        results.append({**pdf_result_base(record, path), "status": status})
    return {"fetchedAt": fetched_at, "records": len(records), "byStatus": count_by(results, "status"), "results": results}


def tribunal_pdf_path(out: Path, record: dict[str, Any]) -> Path:
    position = record.get("position") or stable_slug(record.get("legalName", "unknown"))
    return out / str(record["kind"]) / f"{position}-{stable_slug(record.get('legalName', 'unknown'))}.pdf"


def pdf_result_base(record: dict[str, Any], path: Path) -> dict[str, Any]:
    return {
        "id": record["id"],
        "kind": record["kind"],
        "position": record.get("position"),
        "legalName": record.get("legalName"),
        "sourceUrl": record["sourceUrl"],
        "path": str(path),
    }


def parse_tribunal_pdfs(entities: list[dict[str, Any]], pdf_dir: Path) -> list[dict[str, Any]]:
    parsed_at = datetime.now(timezone.utc).isoformat()
    rows = []
    for entity in entities:
        path = tribunal_pdf_path(pdf_dir, entity)
        row = {
            "id": f"{entity['id']}-pdf",
            "entityId": entity["id"],
            "kind": entity["kind"],
            "position": entity.get("position"),
            "listedDate": entity.get("listedDate"),
            "legalName": entity.get("legalName"),
            "shortName": entity.get("shortName"),
            "sourceUrl": entity.get("sourceUrl"),
            "pdfPath": str(path),
            "parsedAt": parsed_at,
            "indexExtracted": extract_legal_metadata(entity.get("rawParagraphText") or ""),
        }
        if not path.exists():
            rows.append({**row, "pdfStatus": "missing"})
            continue
        pdf_bytes = path.read_bytes()
        text_result = extract_pdf_text(path)
        rows.append(
            {
                **row,
                "pdfStatus": "stored",
                "byteSize": len(pdf_bytes),
                "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
                "pdfTextStatus": text_result["status"],
                "pdfTextLength": len(text_result.get("text") or ""),
                "pdfExtracted": extract_legal_metadata(text_result.get("text") or ""),
                "pdfTextSample": (text_result.get("text") or "")[:1000],
                "pdfTextError": text_result.get("error"),
            }
        )
    return rows


def extract_pdf_text(path: Path) -> dict[str, Any]:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return {"status": "unavailable", "error": "pypdf is not installed"}
    try:
        reader = PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return {"status": "parsed" if text.strip() else "empty", "text": clean_text(text)}
    except Exception as error:  # noqa: BLE001 - PDF parser failures are recorded per file.
        return {"status": "failed", "error": str(error)}


def extract_legal_metadata(text: str) -> dict[str, Any]:
    cleaned = clean_text(text)
    return {
        "decisionNumber": first_match(cleaned, r"(?:sentin[țţ]ei|deciziei)\s+civile\s+nr\.?\s*([A-Za-z0-9./ -]+?)(?:\s+pronun|,|\s+în\s+dosar|$)"),
        "caseNumber": first_match(cleaned, r"dosar(?:ul)?\s+nr\.?\s*([0-9]+/[0-9]+/[0-9]+)"),
        "hearingDate": first_date_match(cleaned, r"(?:[șş]edin[țţ]a\s+public[ăa]\s+(?:din\s+data\s+de|de\s+la)|data\s+de)\s+"),
        "definitiveDate": first_date_match(cleaned, r"definitiv[ăa]?(?:\s+la\s+data\s+de)?\s+"),
    }


def first_match(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return clean_text(match.group(1)).strip(" .,:;") if match else None


def first_date_match(text: str, prefix_pattern: str) -> str | None:
    match = re.search(prefix_pattern + r"(\d{1,2}[./]\d{1,2}[./]\d{4})", text, flags=re.IGNORECASE)
    if not match:
        return None
    return normalize_date(match.group(1))


def normalize_date(value: str) -> str | None:
    match = re.match(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", value.strip())
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def write_tribunal_pdf_report(rows: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    by_status = count_by(rows, "pdfStatus")
    stored_rows = [row for row in rows if row.get("pdfStatus") == "stored"]
    by_text_status = count_by(stored_rows, "pdfTextStatus")
    lines = [
        "# Tribunalul București PDF Metadata Summary",
        "",
        "Raw PDFs are local-only. This report summarizes extracted metadata JSONL.",
        "",
        "## Counts",
        "",
    ]
    for status, count in sorted(by_status.items()):
        lines.append(f"- PDF `{status}`: {count}")
    for status, count in sorted(by_text_status.items()):
        lines.append(f"- Text `{status}`: {count}")
    lines.extend(["", "## Sample Stored Records", ""])
    for row in stored_rows[:20]:
        lines.append(f"- `{row['kind']}` #{row.get('position')}: {row.get('legalName')} ({row.get('byteSize')} bytes)")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def match_tribunal_app_entities(tribunal_rows: list[dict[str, Any]], candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidate_index = [candidate_match_record(candidate) for candidate in candidates]
    rows = []
    for row in tribunal_rows:
        ranked = sorted(
            (
                score_tribunal_candidate(row, candidate)
                for candidate in candidate_index
            ),
            key=lambda item: item["score"],
            reverse=True,
        )
        matches = [item for item in ranked if item["score"] > 0][:5]
        best = matches[0] if matches else None
        score = int(best["score"]) if best else 0
        rows.append(
            {
                "tribunalEntityId": row["entityId"],
                "kind": row.get("kind"),
                "position": row.get("position"),
                "legalName": row.get("legalName"),
                "shortName": row.get("shortName"),
                "sourceUrl": row.get("sourceUrl"),
                "caseNumber": preferred_extracted_value(row, "caseNumber"),
                "decisionNumber": preferred_extracted_value(row, "decisionNumber"),
                "hearingDate": preferred_extracted_value(row, "hearingDate"),
                "definitiveDate": preferred_extracted_value(row, "definitiveDate"),
                "matchStatus": "auto_match" if score >= 92 else "needs_review" if score >= 65 else "no_match",
                "bestScore": score,
                "matches": matches,
            }
        )
    return rows


def candidate_match_record(candidate: dict[str, Any]) -> dict[str, Any]:
    labels = [candidate.get("label") or "", *(candidate.get("names") or [])]
    normalized = unique_strings([normalize_match_text(label) for label in labels if label])
    compact = unique_strings([compact_match_text(label) for label in labels if label])
    stripped = unique_strings([strip_entity_boilerplate(label) for label in labels if label])
    return {
        "label": candidate.get("label"),
        "likelyKind": candidate.get("likelyKind"),
        "ids": candidate.get("ids") or [],
        "partyIds": candidate.get("partyIds") or [],
        "names": candidate.get("names") or [],
        "legislatures": candidate.get("legislatures") or [],
        "normalized": normalized,
        "compact": compact,
        "stripped": stripped,
    }


def score_tribunal_candidate(row: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    legal_name = row.get("legalName") or ""
    short_name = row.get("shortName") or ""
    tribunal_values = [value for value in [short_name, legal_name] if value]
    legal_normalized = normalize_match_text(legal_name) if legal_name else ""
    short_normalized = normalize_match_text(short_name) if short_name else ""
    tribunal_normalized = unique_strings([normalize_match_text(value) for value in tribunal_values])
    tribunal_compact = unique_strings([compact_match_text(value) for value in tribunal_values])
    tribunal_stripped = unique_strings([strip_entity_boilerplate(value) for value in tribunal_values])
    score = 0
    reason = ""
    if legal_normalized and legal_normalized in candidate["normalized"]:
        score, reason = 96, "exact_label_or_name"
    elif short_normalized and short_normalized in candidate["normalized"]:
        score, reason = short_name_score(short_name)
    elif any(value in candidate["compact"] for value in tribunal_compact):
        score, reason = compact_label_score(tribunal_compact)
    elif any(value in candidate["stripped"] for value in tribunal_stripped if value):
        score, reason = 84, "exact_boilerplate_stripped"
    else:
        score, reason = token_similarity_score(tribunal_stripped, candidate["stripped"])
    return {
        "score": score,
        "reason": reason,
        "label": candidate["label"],
        "kind": candidate["likelyKind"],
        "ids": candidate["ids"],
        "partyIds": candidate["partyIds"],
        "legislatures": candidate["legislatures"],
    }


def short_name_score(short_name: str) -> tuple[int, str]:
    compact = compact_match_text(short_name)
    if len(compact) <= 3:
        return 88, "exact_short_name_needs_review"
    return 100, "exact_short_name"


def compact_label_score(values: list[str]) -> tuple[int, str]:
    shortest = min((len(value) for value in values if value), default=0)
    if shortest <= 3:
        return 88, "exact_compact_label_needs_review"
    return 94, "exact_compact_label"


def token_similarity_score(left_values: list[str], right_values: list[str]) -> tuple[int, str]:
    best_score = 0
    best_reason = ""
    for left in left_values:
        left_tokens = set(left.split())
        if not left_tokens:
            continue
        for right in right_values:
            right_tokens = set(right.split())
            if not right_tokens:
                continue
            overlap = len(left_tokens & right_tokens)
            denominator = max(len(left_tokens), len(right_tokens))
            score = int((overlap / denominator) * 80)
            if overlap >= 2 and score > best_score:
                best_score = score
                best_reason = "token_overlap"
    return best_score, best_reason


def preferred_extracted_value(row: dict[str, Any], key: str) -> str | None:
    pdf = row.get("pdfExtracted") or {}
    index = row.get("indexExtracted") or {}
    return pdf.get(key) or index.get(key)


def write_tribunal_match_report(rows: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    by_status = count_by(rows, "matchStatus")
    lines = [
        "# Tribunalul București App Entity Match Review",
        "",
        "File-only match report. Review before using any match as canonical data.",
        "",
        "## Counts",
        "",
    ]
    for status, count in sorted(by_status.items()):
        lines.append(f"- `{status}`: {count}")
    lines.extend(["", "## Needs Review / No Match", ""])
    lines.append("| Kind | # | Tribunal name | Short | Best match | Score | Reason | Source |")
    lines.append("| --- | ---: | --- | --- | --- | ---: | --- | --- |")
    for row in [item for item in rows if item["matchStatus"] != "auto_match"][:200]:
        best = row["matches"][0] if row["matches"] else {}
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_cell(str(row.get("kind") or "")),
                    escape_cell(str(row.get("position") or "")),
                    escape_cell(str(row.get("legalName") or "")),
                    escape_cell(str(row.get("shortName") or "")),
                    escape_cell(str(best.get("label") or "-")),
                    escape_cell(str(row.get("bestScore") or 0)),
                    escape_cell(str(best.get("reason") or "-")),
                    escape_cell(str(row.get("sourceUrl") or "")),
                ]
            )
            + " |"
        )
    lines.extend(["", "## Auto Matches", ""])
    lines.append("| Kind | # | Tribunal name | App match | Score | Source |")
    lines.append("| --- | ---: | --- | --- | ---: | --- |")
    for row in [item for item in rows if item["matchStatus"] == "auto_match"][:100]:
        best = row["matches"][0] if row["matches"] else {}
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_cell(str(row.get("kind") or "")),
                    escape_cell(str(row.get("position") or "")),
                    escape_cell(str(row.get("legalName") or "")),
                    escape_cell(str(best.get("label") or "")),
                    escape_cell(str(row.get("bestScore") or 0)),
                    escape_cell(str(row.get("sourceUrl") or "")),
                ]
            )
            + " |"
        )
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def normalize_match_text(value: str) -> str:
    normalized = value.translate(str.maketrans("ăâîșşțţĂÂÎȘŞȚŢ", "aaiss ttAAISS TT".replace(" ", ""))).lower()
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def compact_match_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", normalize_match_text(value))


def strip_entity_boilerplate(value: str) -> str:
    text = normalize_match_text(value)
    text = re.sub(
        r"\b(partidul|partid|politic|politica|alianta|uniunea|miscarea|frontul|national|nationala|roman|romana|romaniei|din|de|si|pentru|al|a|ai|ale|the)\b",
        " ",
        text,
    )
    return re.sub(r"\s+", " ", text).strip()


def unique_strings(values: list[str]) -> list[str]:
    return [value for value in dict.fromkeys(values) if value]


def escape_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


@dataclass
class ParsedParagraph:
    text: str
    links: list[dict[str, str]] = field(default_factory=list)


class TribunalParagraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[ParsedParagraph] = []
        self._in_p = False
        self._p_parts: list[str] = []
        self._p_links: list[dict[str, str]] = []
        self._current_href: str | None = None
        self._current_link_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "p":
            self._in_p = True
            self._p_parts = []
            self._p_links = []
        if self._in_p and tag == "a":
            attrs_dict = dict(attrs)
            self._current_href = attrs_dict.get("href")
            self._current_link_parts = []

    def handle_endtag(self, tag: str) -> None:
        if self._in_p and tag == "a" and self._current_href:
            text = clean_text("".join(self._current_link_parts))
            self._p_links.append({"href": self._current_href, "text": text})
            self._current_href = None
            self._current_link_parts = []
        if tag == "p" and self._in_p:
            text = clean_text("".join(self._p_parts))
            if text or self._p_links:
                self.paragraphs.append(ParsedParagraph(text=text, links=self._p_links))
            self._in_p = False
            self._p_parts = []
            self._p_links = []

    def handle_data(self, data: str) -> None:
        if not self._in_p:
            return
        self._p_parts.append(data)
        if self._current_href is not None:
            self._current_link_parts.append(data)


class WikipediaArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.infobox_lines: list[str] = []
        self._in_p = False
        self._p_parts: list[str] = []
        self._infobox_depth = 0
        self._infobox_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        classes = attrs_dict.get("class") or ""
        if tag == "p":
            self._in_p = True
            self._p_parts = []
        if tag == "table" and "infobox" in classes:
            self._infobox_depth = 1
            self._infobox_parts = []
            return
        if self._infobox_depth > 0:
            self._infobox_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._in_p:
            text = clean_text("".join(self._p_parts))
            if text:
                self.paragraphs.append(text)
            self._in_p = False
            self._p_parts = []
        if self._infobox_depth > 0:
            self._infobox_depth -= 1
            if self._infobox_depth == 0:
                text = clean_text(" ".join(self._infobox_parts))
                self.infobox_lines = split_infobox_text(text)
                self._infobox_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_p:
            self._p_parts.append(data)
        if self._infobox_depth > 0:
            self._infobox_parts.append(data)


def split_infobox_text(text: str) -> list[str]:
    markers = [
        "Fondat",
        "Fondată",
        "Înființat",
        "Înființată",
        "Reînființat",
        "Reînființată",
        "Dizolvat",
        "Dizolvată",
        "Precedat",
        "Succedat",
        "Fuziune",
    ]
    parts = [text]
    for marker in markers:
        parts = [
            item
            for part in parts
            for item in re.split(rf"(?=\b{re.escape(marker)}\b)", part)
        ]
    return [clean_text(part) for part in parts if clean_text(part)]


def split_sentences(text: str) -> list[str]:
    return [clean_text(part) for part in re.split(r"(?<=[.!?])\s+", text) if clean_text(part)]


def is_history_candidate_text(text: str) -> bool:
    normalized = normalize_match_text(text)
    return any(normalize_match_text(keyword) in normalized for keyword in WIKIPEDIA_HISTORY_KEYWORDS)


def event_hint_from_text(text: str) -> str:
    normalized = normalize_match_text(text)
    if "reinf" in normalized:
        return "party_reestablished"
    if "fondat" in normalized or "infiint" in normalized:
        return "party_founded"
    if "absorbit" in normalized:
        return "party_absorbed"
    if "fuzionat" in normalized or "fuziune" in normalized:
        return "party_merged"
    if "aliant" in normalized:
        return "alliance_context"
    if "dizolvat" in normalized:
        return "party_or_alliance_dissolved"
    if "redenumit" in normalized:
        return "party_renamed"
    if "scindat" in normalized or "desprins" in normalized:
        return "party_split"
    return "history_context"


def extract_romanian_date_candidates(text: str) -> list[str]:
    dates: list[str] = []
    for day, month, year in re.findall(r"\b(\d{1,2})\s+([A-Za-zĂÂÎȘŞȚŢăâîșşțţ]+)\s+(\d{4})\b", text):
        month_number = ROMANIAN_MONTHS.get(month.lower())
        if month_number:
            dates.append(f"{year}-{month_number}-{int(day):02d}")
    for day, month, year in re.findall(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b", text):
        dates.append(f"{year}-{int(month):02d}-{int(day):02d}")
    for year in re.findall(r"\b(19[89]\d|20\d{2})\b", text):
        if not any(date.startswith(year) for date in dates):
            dates.append(year)
    return unique_strings(dates)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def extract_position(text: str) -> int | None:
    match = re.match(r"\s*(\d+)\.", text)
    return int(match.group(1)) if match else None


def extract_legal_name(text: str) -> str:
    value = re.sub(r"^\s*\d+\.\s*", "", text).strip()
    value = re.sub(r"^\d{1,2}\.\d{1,2}\.\d{4}\s*[–-]\s*", "", value).strip()
    integral = re.search(r"denumirea(?:\s+integrală)?\s+[„\"]([^”\"]+)[”\"]", value, flags=re.IGNORECASE)
    if integral:
        return clean_text(integral.group(1)).strip(" .,;")
    value = re.split(r"\s+[–-]\s+(?:cu\s+)?(?:denumirea|Denumirea|P\.|[A-ZĂÂÎȘŞȚŢ]\.)", value, maxsplit=1)[0].strip()
    value = re.split(r"\s+şi\s+denumirea\s+prescurtată", value, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    return value.strip(" .,;")


def extract_short_name(link_text: str, paragraph_text: str) -> str | None:
    patterns = [
        r"denumirea\s+prescurtată(?:\s+este)?\s*[:：]?\s*[–-]?\s*(?:[A-Za-zĂÂÎȘŞȚŢăâîșşțţ ]+)?[„\"]([^”\"]+)[”\"]",
        r"denumirea\s+prescurtată(?:\s+este)?\s*[:：]?\s*([A-ZĂÂÎȘŞȚŢ0-9][A-ZĂÂÎȘŞȚŢ0-9 .+\-]{1,40}?)(?:\s+-|,|\(|$)",
        r"\s+[–-]\s*([A-ZĂÂÎȘŞȚŢ0-9][A-ZĂÂÎȘŞȚŢ0-9 .+\\-]{1,30})\s*$",
    ]
    for source in [paragraph_text, link_text]:
        for index, pattern in enumerate(patterns):
            if index == 2 and extract_leading_date(source):
                continue
            match = re.search(pattern, source, flags=re.IGNORECASE)
            if not match:
                continue
            candidate = clean_text(match.group(1)).strip(" .,;:”“\"")
            if candidate and not candidate.lower().startswith("cu denumirea"):
                return candidate
    return None


def extract_leading_date(text: str) -> str | None:
    value = re.sub(r"^\s*\d+\.\s*", "", text).strip()
    match = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[–-]", value)
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def normalize_romanian_text(value: str) -> str:
    table = str.maketrans("ăâîșşțţĂÂÎȘŞȚŢ", "aaiss ttAAISS TT".replace(" ", ""))
    normalized = value.translate(table).lower()
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


def stable_slug(value: str) -> str:
    slug = normalize_romanian_text(value)
    return slug or "unknown"


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
