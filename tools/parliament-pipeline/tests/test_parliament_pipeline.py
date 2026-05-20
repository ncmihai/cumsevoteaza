from __future__ import annotations

import json
import subprocess
import sys
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


if __name__ == "__main__":
    unittest.main()
