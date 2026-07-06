#!/usr/bin/env python3
"""CLI wrapper for the Qwen → PDF pipeline."""
import argparse
import csv
import io
import sys
from collections import Counter, defaultdict
from pathlib import Path

from brand import CORPORATE_BLUE, NT_BRAND, THAI_NT_BRAND
from build_pdf import build_pdf
from qwen_client import MODEL_NAME, VLLM_BASE_URL, generate_report_json

BRANDS = {
    "nt": NT_BRAND,
    "thai_nt": THAI_NT_BRAND,
    "corporate_blue": CORPORATE_BLUE,
}


def _number(value):
    text = str(value if value is not None else "").strip().replace(",", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def _parse_csv(text):
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except csv.Error:
        return [], []
    if not rows:
        return [], []
    columns = list(rows[0].keys())
    clean_rows = [{column: (row.get(column) or "").strip() for column in columns} for row in rows]
    return columns, clean_rows


def build_data_profile(raw_text, max_sample_rows=16):
    """Compress large CSVs into facts DeepSeek can reliably plan from."""
    columns, rows = _parse_csv(raw_text)
    if not columns or not rows:
        return {
            "kind": "text",
            "text": raw_text[:12000],
            "planner_text": raw_text[:12000],
            "row_count": 0,
            "columns": [],
            "numeric_stats": [],
            "category_tops": [],
            "sample_rows": [],
            "aggregates": [],
        }

    numeric_stats = []
    numeric_by_column = {}
    for column in columns:
        values = [_number(row.get(column)) for row in rows]
        values = [value for value in values if value is not None]
        if not values:
            continue
        numeric_by_column[column] = values
        total = sum(values)
        numeric_stats.append({
            "column": column,
            "count": len(values),
            "sum": round(total, 2),
            "avg": round(total / len(values), 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
        })

    category_tops = []
    for column in columns:
        if column in numeric_by_column:
            continue
        values = [str(row.get(column) or "").strip() for row in rows if str(row.get(column) or "").strip()]
        if not values:
            continue
        top = Counter(values).most_common(8)
        category_tops.append({"column": column, "top": top})

    aggregates = []
    if category_tops and numeric_stats:
        category_column = category_tops[0]["column"]
        for metric in numeric_stats[:3]:
            totals = defaultdict(float)
            for row in rows:
                key = str(row.get(category_column) or "Unknown").strip() or "Unknown"
                value = _number(row.get(metric["column"]))
                if value is not None:
                    totals[key] += value
            top_totals = sorted(totals.items(), key=lambda item: abs(item[1]), reverse=True)[:8]
            aggregates.append({
                "by": category_column,
                "metric": metric["column"],
                "top_totals": [(label, round(value, 2)) for label, value in top_totals],
            })

    sample_rows = rows[:max_sample_rows]
    lines = [
        "DATASET PROFILE (computed from the uploaded file; use only these facts):",
        f"- row_count: {len(rows)}",
        f"- column_count: {len(columns)}",
        f"- columns: {', '.join(columns)}",
        "",
        "NUMERIC STATS:",
        *[
            f"- {item['column']}: count={item['count']}, sum={item['sum']}, avg={item['avg']}, min={item['min']}, max={item['max']}"
            for item in numeric_stats[:12]
        ],
        "",
        "TOP CATEGORIES:",
        *[
            f"- {item['column']}: " + "; ".join(f"{label}={count}" for label, count in item["top"])
            for item in category_tops[:8]
        ],
        "",
        "AGGREGATES:",
        *[
            f"- {item['metric']} by {item['by']}: " + "; ".join(f"{label}={value}" for label, value in item["top_totals"])
            for item in aggregates[:6]
        ],
        "",
        "SAMPLE ROWS:",
        *[str(row) for row in sample_rows],
    ]
    return {
        "kind": "rows",
        "text": raw_text,
        "planner_text": "\n".join(lines)[:18000],
        "row_count": len(rows),
        "columns": columns,
        "numeric_stats": numeric_stats,
        "category_tops": category_tops,
        "sample_rows": sample_rows,
        "aggregates": aggregates,
    }


def fallback_report_json(profile, instruction):
    title = "AI Generated PDF Report"
    subtitle = "Deterministic fallback from computed dataset profile"
    numeric_stats = profile.get("numeric_stats", [])
    aggregates = profile.get("aggregates", [])
    columns = profile.get("columns", [])
    row_count = profile.get("row_count", 0)
    kpis = [
        {"label": "Rows", "value": str(row_count), "delta": "uploaded data"},
        {"label": "Columns", "value": str(len(columns)), "delta": "detected fields"},
        {"label": "Numeric KPIs", "value": str(len(numeric_stats)), "delta": "computed metrics"},
    ]
    for item in numeric_stats[:3]:
        kpis.append({"label": f"{item['column']} avg", "value": str(item["avg"]), "delta": f"sum {item['sum']}"})

    pages = [
        {"layout": "cover", "title": title, "subtitle": subtitle, "meta": instruction[:180]},
        {"layout": "kpi_grid", "heading": "Executive KPI Summary", "kpis": kpis[:6]},
    ]

    if aggregates:
        first = aggregates[0]
        pages.append({
            "layout": "full_chart",
            "heading": f"{first['metric']} by {first['by']}",
            "body": "Chart generated from deterministic aggregation when model JSON planning was unavailable.",
            "chart": {
                "type": "barh",
                "title": f"Top {first['by']} by {first['metric']}",
                "labels": [str(label) for label, _value in first["top_totals"]],
                "values": [float(value) for _label, value in first["top_totals"]],
            },
        })
    elif numeric_stats:
        pages.append({
            "layout": "full_chart",
            "heading": "Numeric KPI Totals",
            "body": "Totals computed directly from numeric columns in the uploaded file.",
            "chart": {
                "type": "bar",
                "title": "Top Numeric Column Sums",
                "labels": [item["column"] for item in numeric_stats[:8]],
                "values": [float(item["sum"]) for item in numeric_stats[:8]],
            },
        })

    metric_rows = [["Rows", row_count], ["Columns", len(columns)]]
    metric_rows.extend([[item["column"], f"sum={item['sum']}, avg={item['avg']}, max={item['max']}"] for item in numeric_stats[:12]])
    pages.append({
        "layout": "table_only",
        "heading": "Computed Data Profile",
        "body": "These values were computed from the uploaded dataset before PDF rendering.",
        "table": {"headers": ["Metric", "Value"], "rows": metric_rows},
    })
    pages.append({
        "layout": "text_block",
        "heading": "Recommendation",
        "body": "Review the highest-volume metrics and top category aggregations, then validate missing values, ownership fields, and expiry dates before operational decisions.",
    })
    return {"pages": pages}


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a PDF report from data via Qwen JSON planning.")
    parser.add_argument("--data", required=True, help="Path to a text/CSV/log file to summarize.")
    parser.add_argument("--instruction", required=True, help="Instruction for Qwen's report planner.")
    parser.add_argument("--out", required=True, help="Output PDF path.")
    parser.add_argument("--brand", choices=sorted(BRANDS), default="nt", help="Brand palette to apply.")
    parser.add_argument("--base-url", default=VLLM_BASE_URL, help="OpenAI-compatible vLLM base URL.")
    parser.add_argument("--model", default=MODEL_NAME, help="Model name served by vLLM.")
    return parser.parse_args()


def main():
    args = parse_args()
    data_path = Path(args.data)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    raw_data_text = data_path.read_text(encoding="utf-8")
    profile = build_data_profile(raw_data_text)
    try:
        report_json = generate_report_json(
            raw_data_text=profile["planner_text"],
            instruction=args.instruction,
            base_url=args.base_url,
            model=args.model,
        )
    except Exception as exc:
        print(f"Planner fallback: {exc}", file=sys.stderr)
        report_json = fallback_report_json(profile, args.instruction)
    chart_dir = out_path.parent / f"{out_path.stem}_charts"
    result = build_pdf(report_json, str(out_path), brand=BRANDS[args.brand], chart_dir=str(chart_dir))
    print(f"Built: {result}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"run_report failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
