from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE = REPO_ROOT / "tools" / "parliament-pipeline" / "parliament_pipeline.py"


class ParliamentPipelineCliTest(unittest.TestCase):
    def run_pipeline(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(PIPELINE), *args],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

    def test_domains_documents_file_first_boundary(self) -> None:
        completed = self.run_pipeline("domains")
        payload = json.loads(completed.stdout)
        cdep = next(domain for domain in payload["domains"] if domain["name"] == "cdep-members")
        self.assertEqual(cdep["status"], "implemented")
        self.assertIn("data/cdep-history/parsed/profiles.jsonl", cdep["outputs"])
        self.assertIn("ingest:cdep-history:import", cdep["dbWriter"])

    def test_historical_members_plan_keeps_typescript_db_writer(self) -> None:
        completed = self.run_pipeline("plan", "historical-members")
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["currentDbBoundary"], "Python writes JSON/JSONL only; TypeScript writes Postgres.")
        self.assertIn("Persist to local Postgres, verify counts and sample profiles.", payload["steps"])

    def test_cdep_roster_urls_delegates_to_existing_probe(self) -> None:
        completed = self.run_pipeline("cdep-members", "roster-urls", "--legislature", "2004", "--chamber", "both")
        urls = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
        self.assertEqual(
            urls,
            [
                "https://cdep.ro/ords/pls/parlam/structura.de?leg=2004",
                "https://cdep.ro/ords/pls/parlam/structura.de?leg=2004&cam=1",
            ],
        )

    def test_cdep_asset_inventory_writes_jsonl_and_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            profiles = tmp_dir / "profiles.jsonl"
            assets = tmp_dir / "assets.jsonl"
            report = tmp_dir / "assets.json"
            profile = {
                "profileKey": "leg2004:cam2:idm297",
                "url": "https://cdep.ro/ords/pls/parlam/structura.mp?cam=2&idm=297&leg=2004",
                "identity": {"officialId": "297", "legislature": "2004", "chamber": "deputies", "cam": "2"},
                "name": "Popescu Ion",
                "snapshot": {"contentHash": "abc", "fetchedAt": "2026-05-21T00:00:00+00:00"},
                "photoUrls": ["https://cdep.ro/parlamentari/poza?idm=297&leg=2004"],
                "logoUrls": ["https://cdep.ro/aleg/psd2004.jpg"],
                "activityLinks": [{"url": "https://cdep.ro/pls/parlam/cv?idm=297", "label": "Curriculum Vitae"}],
                "careerLinks": [],
            }
            profiles.write_text(json.dumps(profile, ensure_ascii=False) + "\n", encoding="utf-8")

            completed = self.run_pipeline(
                "cdep-members",
                "asset-inventory",
                "--profiles",
                str(profiles),
                "--out",
                str(assets),
                "--report",
                str(report),
            )
            summary = json.loads(completed.stdout)
            rows = [json.loads(line) for line in assets.read_text(encoding="utf-8").splitlines() if line.strip()]
            saved_report = json.loads(report.read_text(encoding="utf-8"))

            self.assertEqual(summary["assets"], 3)
            self.assertEqual(saved_report["summary"]["byAssetType"], {"cv": 1, "party_logo": 1, "photo": 1})
            self.assertEqual({row["entityId"] for row in rows}, {"member-deputies-2004-297"})
            self.assertEqual({row["legislatureId"] for row in rows}, {"leg-2004-2008"})

    def test_tribunal_parse_index_writes_jsonl_and_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            raw = tmp_dir / "raw"
            parsed = tmp_dir / "parsed" / "tribunal_entities.jsonl"
            report = tmp_dir / "reports" / "index-summary.md"
            raw.mkdir()
            (raw / "index-partide-politice.html").write_text(
                """
                <p style="text-align: justify;"><a href="/images/articole/politice-partide/poz-48.pdf" target="_blank">48. PARTIDUL UNIUNEA NAŢIONALĂ PENTRU PROGRESUL ROMÂNIEI –U.N.P.R.</a></p>
                <p style="text-align: justify;"><a href="/images/articole/politice-partide/poz-293.pdf" target="_blank">293. PARTIDUL POLITIC CU DENUMIREA „PARTIDUL OAMENILOR TINERI”</a> şi denumirea prescurtată POT</p>
                """,
                encoding="utf-8",
            )
            (raw / "index-aliante-politice.html").write_text(
                """
                <p><a href="/images/articole/politice-aliante/poz-9-Alianta_USR_PLUS.pdf">9. ALIANŢA 2020 USR PLUS</a></p>
                """,
                encoding="utf-8",
            )
            (raw / "index-alte-forme-de-asociere.html").write_text(
                """
                <p><a href="/images/articole/politice-alte/poz-1-aliantaPSL.pdf">1. ALIANŢA PENTRU SĂNĂTATE ŞI LIBERTATE</a></p>
                """,
                encoding="utf-8",
            )

            completed = self.run_pipeline(
                "tribunal-registry",
                "parse-index",
                "--raw",
                str(raw),
                "--out",
                str(parsed),
                "--report",
                str(report),
            )
            summary = json.loads(completed.stdout)
            rows = [json.loads(line) for line in parsed.read_text(encoding="utf-8").splitlines() if line.strip()]

            self.assertEqual(summary["records"], 4)
            self.assertEqual(summary["byKind"], {"alliance": 1, "other_association": 1, "party": 2})
            self.assertEqual(rows[0]["kind"], "alliance")
            self.assertEqual(rows[-1]["shortName"], "POT")
            self.assertIn("Tribunalul București Registry Index Summary", report.read_text(encoding="utf-8"))

    def test_tribunal_parse_pdfs_writes_metadata_without_committing_raw_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            entities = tmp_dir / "entities.jsonl"
            pdf_dir = tmp_dir / "pdfs"
            out = tmp_dir / "parsed" / "tribunal_pdf_metadata.jsonl"
            report = tmp_dir / "reports" / "pdf-summary.md"
            record = {
                "id": "tribunal-party-48",
                "kind": "party",
                "position": 48,
                "listedDate": None,
                "legalName": "PARTIDUL UNIUNEA NAŢIONALĂ PENTRU PROGRESUL ROMÂNIEI",
                "shortName": "U.N.P.R",
                "sourceUrl": "https://tribunalulbucuresti.ro/images/articole/politice-partide/poz-48.pdf",
                "rawParagraphText": "înregistrat conform dispoziţiilor sentinţei civile nr. 12/P pronunţate de Tribunalul Bucureşti, în dosarul nr. 1234/3/2010, în şedinţa publică din data de 01.05.2010, definitivă la data de 10.05.2010.",
            }
            entities.write_text(json.dumps(record, ensure_ascii=False) + "\n", encoding="utf-8")
            pdf_path = pdf_dir / "party" / "48-partidul-uniunea-nationala-pentru-progresul-romaniei.pdf"
            pdf_path.parent.mkdir(parents=True)
            pdf_path.write_bytes(b"%PDF-1.4 fake local fixture")

            completed = self.run_pipeline(
                "tribunal-registry",
                "parse-pdfs",
                "--entities",
                str(entities),
                "--pdf-dir",
                str(pdf_dir),
                "--out",
                str(out),
                "--report",
                str(report),
            )
            summary = json.loads(completed.stdout)
            rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line.strip()]

            self.assertEqual(summary["records"], 1)
            self.assertEqual(rows[0]["pdfStatus"], "stored")
            self.assertEqual(rows[0]["indexExtracted"]["caseNumber"], "1234/3/2010")
            self.assertEqual(rows[0]["indexExtracted"]["hearingDate"], "2010-05-01")
            self.assertIn("Tribunalul București PDF Metadata Summary", report.read_text(encoding="utf-8"))

    def test_tribunal_match_app_entities_writes_review_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            tribunal = tmp_dir / "tribunal_pdf_metadata.jsonl"
            candidates = tmp_dir / "political-entity-candidates.json"
            out = tmp_dir / "parsed" / "tribunal_app_entity_matches.jsonl"
            report = tmp_dir / "reports" / "match-review.md"
            tribunal.write_text(
                json.dumps(
                    {
                        "entityId": "tribunal-party-203",
                        "kind": "party",
                        "position": 203,
                        "legalName": "ALIANŢA PENTRU UNIREA ROMÂNILOR",
                        "shortName": "AUR",
                        "sourceUrl": "https://tribunalulbucuresti.ro/example.pdf",
                        "indexExtracted": {"caseNumber": "24194/3/2019"},
                    },
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )
            candidates.write_text(
                json.dumps(
                    [
                        {
                            "label": "AUR",
                            "likelyKind": "party",
                            "ids": ["party-aur"],
                            "names": ["Alianța pentru Unirea Românilor"],
                            "partyIds": ["party-aur"],
                            "legislatures": ["2024-2028"],
                        }
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            completed = self.run_pipeline(
                "tribunal-registry",
                "match-app-entities",
                "--tribunal",
                str(tribunal),
                "--candidates",
                str(candidates),
                "--out",
                str(out),
                "--report",
                str(report),
            )
            summary = json.loads(completed.stdout)
            rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line.strip()]

            self.assertEqual(summary["byStatus"], {"auto_match": 1})
            self.assertEqual(rows[0]["matches"][0]["ids"], ["party-aur"])
            self.assertEqual(rows[0]["caseNumber"], "24194/3/2019")
            self.assertIn("Tribunalul București App Entity Match Review", report.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
