#!/usr/bin/env python3
"""CLI wrapper for the Qwen → PDF pipeline."""
import argparse
import sys
from pathlib import Path

from brand import CORPORATE_BLUE, NT_BRAND, THAI_NT_BRAND
from build_pdf import build_pdf
from qwen_client import MODEL_NAME, VLLM_BASE_URL, generate_report_json

BRANDS = {
    "nt": NT_BRAND,
    "thai_nt": THAI_NT_BRAND,
    "corporate_blue": CORPORATE_BLUE,
}


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
    report_json = generate_report_json(
        raw_data_text=raw_data_text,
        instruction=args.instruction,
        base_url=args.base_url,
        model=args.model,
    )
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
