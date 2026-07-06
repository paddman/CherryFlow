"""
Demonstrates the full pipeline WITHOUT needing a live Qwen call —
this JSON is exactly the shape generate_report_json() would return.
Swap in a real call like:

    from qwen_client import generate_report_json
    report = generate_report_json(raw_log_text, "Summarize today's DNS/traffic logs")

"""
from pathlib import Path

from build_pdf import build_pdf
from brand import NT_BRAND

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
CHART_DIR = OUTPUT_DIR / "charts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CHART_DIR.mkdir(parents=True, exist_ok=True)

report = {
    "pages": [
        {
            "layout": "cover",
            "title": "Network & DNS Traffic Report",
            "subtitle": "Daily Operations Summary — Executive Overview",
            "meta": "6 July 2026  |  Prepared by NOC Analytics",
        },
        {
            "layout": "kpi_grid",
            "heading": "1. Key Metrics at a Glance",
            "kpis": [
                {"label": "Peak Inbound", "value": "612 Gbps", "delta": "+4.1%"},
                {"label": "Peak Outbound", "value": "410 Gbps", "delta": "-3.5%"},
                {"label": "DNS Queries", "value": "112,600", "delta": "+3.4%"},
                {"label": "High-Sev Events", "value": "5", "delta": "+2"},
            ],
        },
        {
            "layout": "full_chart",
            "heading": "2. Traffic Overview",
            "body": "Inbound and outbound traffic stayed within normal range, peaking mid-day.",
            "chart": {
                "type": "line", "title": "Network Traffic — Last 24 Hours",
                "x": [f"{h:02d}:00" for h in range(24)],
                "series": {
                    "Inbound (Gbps)": [420, 400, 390, 410, 460, 500, 540, 580, 600, 610, 590, 560,
                                        540, 520, 500, 480, 460, 440, 430, 420, 415, 410, 405, 400],
                    "Outbound (Gbps)": [300, 290, 280, 300, 330, 360, 390, 400, 410, 405, 395, 380,
                                         370, 360, 350, 340, 330, 320, 315, 310, 305, 300, 298, 295],
                },
            },
        },
        {
            "layout": "two_col_charts",
            "heading": "3. Protocol & DNS Query Breakdown",
            "charts": [
                {"type": "pie", "title": "Protocol Distribution",
                 "labels": ["HTTPS", "DNS", "QUIC", "SSH", "Other"], "values": [58, 18, 14, 6, 4]},
                {"type": "bar", "title": "DNS Query Types (24h)",
                 "labels": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
                 "values": [61000, 24000, 18500, 4200, 3100, 1800]},
            ],
        },
        {
            "layout": "chart_with_table",
            "heading": "4. Top Destination Countries",
            "chart": {
                "type": "barh", "title": "Top Destination Countries by Traffic Volume (GB)",
                "highlight_top": True,
                "labels": ["Vietnam", "China", "Hong Kong", "USA", "Japan", "Singapore", "Thailand"],
                "values": [640, 980, 1120, 1540, 1870, 2210, 4820],
            },
            "table": {
                "headers": ["Country", "Volume (GB)", "Share"],
                "rows": [
                    ["Thailand", "4,820", "40.1%"],
                    ["Singapore", "2,210", "18.4%"],
                    ["Japan", "1,870", "15.6%"],
                ],
            },
        },
        {
            "layout": "three_col_charts",
            "heading": "5. Security Events by Region",
            "charts": [
                {"type": "bar", "title": "Bangkok", "labels": ["Low", "Med", "High"], "values": [22, 9, 2]},
                {"type": "bar", "title": "Chiang Mai", "labels": ["Low", "Med", "High"], "values": [14, 5, 1]},
                {"type": "bar", "title": "Khon Kaen", "labels": ["Low", "Med", "High"], "values": [10, 4, 1]},
            ],
        },
        {
            "layout": "text_block",
            "heading": "6. Notes",
            "body": "All figures are illustrative sample data generated to demonstrate the "
                    "report pipeline's layout system, not real NT network telemetry.",
        },
    ]
}

out = build_pdf(report, str(OUTPUT_DIR / "qwen_report_example.pdf"),
                 brand=NT_BRAND, chart_dir=str(CHART_DIR))
print("Built:", out)
