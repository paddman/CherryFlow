import os
import tempfile
import unittest

from brand import NT_BRAND
from chart_renderers import RENDERERS


MINIMAL_SPECS = {
    "line": {
        "type": "line",
        "title": "Line smoke",
        "x": ["00:00", "01:00", "02:00"],
        "series": {"Inbound": [1, 3, 2]},
    },
    "bar": {
        "type": "bar",
        "title": "Bar smoke",
        "labels": ["A", "B", "C"],
        "values": [10, 14, 8],
    },
    "barh": {
        "type": "barh",
        "title": "Barh smoke",
        "labels": ["A", "B", "C"],
        "values": [10, 14, 8],
    },
    "pie": {
        "type": "pie",
        "title": "Pie smoke",
        "labels": ["A", "B", "C"],
        "values": [40, 35, 25],
    },
    "stacked_area": {
        "type": "stacked_area",
        "title": "Stacked smoke",
        "x": ["00:00", "01:00", "02:00"],
        "series": {"Low": [1, 2, 3], "High": [3, 2, 1]},
    },
    "grouped_bar": {
        "type": "grouped_bar",
        "title": "Grouped smoke",
        "labels": ["A", "B", "C"],
        "series": {"This": [3, 5, 4], "Last": [2, 4, 3]},
    },
    "heatmap": {
        "type": "heatmap",
        "title": "Heatmap smoke",
        "x": ["00:00", "01:00", "02:00"],
        "y": ["Mon", "Tue"],
        "values": [[10, 15, 12], [18, 22, 20]],
        "unit": "Gbps",
    },
    "gauge": {
        "type": "gauge",
        "title": "Gauge smoke",
        "value": 72,
        "min": 0,
        "max": 100,
        "threshold": 80,
        "unit": "%",
    },
}


class ChartSmokeTests(unittest.TestCase):
    def test_every_renderer_writes_a_non_empty_png(self):
        missing_specs = set(RENDERERS) - set(MINIMAL_SPECS)
        self.assertFalse(missing_specs, f"Missing smoke specs for chart types: {sorted(missing_specs)}")

        with tempfile.TemporaryDirectory(prefix="chart_smoke_") as tmpdir:
            for chart_type, renderer in RENDERERS.items():
                with self.subTest(chart_type=chart_type):
                    outpath = os.path.join(tmpdir, f"{chart_type}.png")
                    try:
                        renderer(dict(MINIMAL_SPECS[chart_type]), NT_BRAND, outpath)
                    except Exception as exc:  # pragma: no cover - unittest prints chart_type via subTest
                        raise AssertionError(f"{chart_type} renderer failed: {exc}") from exc
                    self.assertTrue(os.path.exists(outpath), f"{chart_type} did not create a PNG")
                    self.assertGreater(os.path.getsize(outpath), 0, f"{chart_type} PNG is empty")


if __name__ == "__main__":
    unittest.main(verbosity=2)
