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
from urllib.parse import urljoin
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
            "data/parliament-pipeline/tribunal-registry/reports/index-summary.md",
            "data/parliament-pipeline/tribunal-registry/reports/pdf-summary.md",
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
    raise SystemExit(f"Unsupported Tribunal command: {args.tribunal_command}")


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
