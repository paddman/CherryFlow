import json
import os
from pathlib import Path
import tempfile
import unittest

from brand import NT_BRAND
from build_pdf import build_pdf

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


class FixtureBuildTests(unittest.TestCase):
    def test_all_fixtures_build_without_network(self):
        fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))
        self.assertGreater(len(fixture_paths), 0, "No fixture JSON files found")

        with tempfile.TemporaryDirectory(prefix="fixture_pdf_") as tmpdir:
            for fixture_path in fixture_paths:
                with self.subTest(fixture=fixture_path.name):
                    report = json.loads(fixture_path.read_text(encoding="utf-8"))
                    pdf_path = Path(tmpdir) / f"{fixture_path.stem}.pdf"
                    chart_dir = Path(tmpdir) / f"{fixture_path.stem}_charts"
                    build_pdf(report, str(pdf_path), brand=NT_BRAND, chart_dir=str(chart_dir))
                    self.assertTrue(pdf_path.exists(), f"{fixture_path.name} did not create a PDF")
                    self.assertGreater(os.path.getsize(pdf_path), 0, f"{fixture_path.name} PDF is empty")


if __name__ == "__main__":
    unittest.main(verbosity=2)
