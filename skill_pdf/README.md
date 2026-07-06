# Qwen → PDF Report Pipeline

Qwen never draws anything. It only outputs JSON describing **which layout**
and **which chart type** to use per page. All visual styling lives in code,
so the output is byte-for-byte consistent no matter what the model says.

```
brand.py            -> colors/fonts, ONE place to re-skin everything
fonts/              -> bundled Sarabun regular/bold for Thai ReportLab text
chart_renderers.py   -> 8 chart types (line, bar, barh, pie, stacked_area,
                         grouped_bar, heatmap, gauge)
templates.py          -> 9 page layouts (cover, full_chart, two_col_charts,
                         three_col_charts, chart_with_table, kpi_grid,
                         table_only, text_block, timeline)
build_pdf.py          -> glues pages together into the final PDF
qwen_client.py        -> calls your local vLLM Qwen endpoint, validates output
example_run.py        -> hand-written JSON proving every layout renders
run_report.py         -> CLI wrapper: data file + instruction -> Qwen JSON -> PDF
test_charts.py        -> smoke test for every registered chart renderer
test_build_pdf_from_fixtures.py -> offline PDF regression from fixtures/*.json
fixtures/             -> saved valid report JSON responses for network-free tests
```

## Run the demo (no Qwen needed)
```bash
python3 example_run.py
```

## Run tests
```bash
python3 test_charts.py
python3 test_build_pdf_from_fixtures.py
```

## Generate via CLI
```bash
python3 run_report.py \
  --data dns_traffic_log.csv \
  --instruction "Summarize today's DNS and traffic logs for an executive report" \
  --out daily_report.pdf \
  --brand nt \
  --base-url http://localhost:8000/v1 \
  --model Qwen2.5-72B-Instruct
```

## Wire it to your real vLLM endpoint
```python
from qwen_client import generate_report_json
from build_pdf import build_pdf

report = generate_report_json(
    raw_data_text=open("dns_traffic_log.csv").read(),
    instruction="Summarize today's DNS and traffic logs for an executive report",
    base_url="http://localhost:8000/v1",   # your vLLM server
    model="Qwen2.5-72B-Instruct",          # whatever tag vLLM serves
)
build_pdf(report, "daily_report.pdf")
```

`qwen_client.py` uses vLLM's `guided_json` extra_body param to force
syntactically valid JSON, then `_validate()` checks every `layout` and
chart `type` is one this codebase actually knows how to render — if Qwen
hallucinates an unknown layout, it gets one automatic retry with the error
message fed back before raising. HTTP/network failures are retried separately
with connect/read timeouts and raise `QwenNetworkError`; model JSON failures
raise `QwenJSONValidationError`.

## Adding a new page layout
1. Write `def layout_my_thing(spec, brand, chart_dir, idx): -> list[Flowable]` in `templates.py`
2. Register it: `LAYOUTS["my_thing"] = layout_my_thing`
3. Add its shape to `SYSTEM_PROMPT` in `qwen_client.py` so Qwen knows it exists

## Adding a new chart type
1. Write `def render_my_chart(spec, brand, outpath): ...` in `chart_renderers.py`
2. Register it: `RENDERERS["my_chart"] = render_my_chart`
3. Document its spec shape in `qwen_client.py`'s `SYSTEM_PROMPT`
4. Add a minimal smoke spec in `test_charts.py`

## Re-skinning for a different brand
Swap the `brand=` argument in `build_pdf()` — see `CORPORATE_BLUE` in
`brand.py` for a second full palette. Every chart and every table instantly
matches, since nothing is hardcoded outside `brand.py`.

Thai ReportLab text is supported by bundled Sarabun regular/bold fonts. Use
`THAI_NT_BRAND` from `brand.py` when the report body contains Thai text. The
default English-oriented brand configs still use Helvetica, so existing output
style remains stable unless a brand opts into Sarabun.
