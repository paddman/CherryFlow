"""
build_pdf(report_json, output_path, brand) -> writes the final PDF.

report_json shape:
{
  "pages": [
    {"layout": "cover", "title": "...", "subtitle": "...", "meta": "..."},
    {"layout": "full_chart", "heading": "...", "body": "...", "chart": {...}},
    {"layout": "two_col_charts", "heading": "...", "charts": [{...}, {...}]},
    {"layout": "chart_with_table", "heading": "...", "chart": {...}, "table": {...}},
    {"layout": "kpi_grid", "heading": "...", "kpis": [{...}, ...]},
    {"layout": "table_only", "heading": "...", "table": {...}},
    {"layout": "text_block", "heading": "...", "body": "..."}
  ]
}
See templates.py LAYOUTS for the exact fields each layout expects, and
chart_renderers.py RENDERERS for the exact fields each chart type expects.
"""
import os
import tempfile
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate

from templates import build_page
from brand import NT_BRAND


def build_pdf(report_json, output_path, brand=NT_BRAND, chart_dir=None):
    chart_dir = chart_dir or tempfile.mkdtemp(prefix="report_charts_")
    os.makedirs(chart_dir, exist_ok=True)

    story = []
    for idx, page_spec in enumerate(report_json["pages"]):
        story.extend(build_page(page_spec, brand, chart_dir, idx))

    # drop trailing page break so we don't get a blank last page
    while story and story[-1].__class__.__name__ == "PageBreak":
        story.pop()

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
    )
    doc.build(story)
    return output_path
