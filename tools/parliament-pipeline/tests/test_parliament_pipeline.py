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


if __name__ == "__main__":
    unittest.main()
