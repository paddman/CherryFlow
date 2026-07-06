"""
Page templates. Each function takes (page_spec, brand, chart_dir, idx) and
returns a list of reportlab Flowables for ONE page. Qwen only ever picks
`page_spec["layout"]` + fills in the data fields — never touches styling.

Add a new layout = add one function + one line in LAYOUTS registry.
"""
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Line, Circle

from chart_renderers import render_chart
from brand import rl

_styles = getSampleStyleSheet()


def _styles_for(brand):
    """Paragraph styles rebuilt per-brand so colors always match brand dict."""
    font_body = brand.get("font_body", "Helvetica")
    font_heading = brand.get("font_heading", "Helvetica-Bold")
    return {
        "title": ParagraphStyle("TitleBig", parent=_styles["Title"],
                                 textColor=rl(brand["primary"]), fontSize=24, leading=28,
                                 fontName=font_heading),
        "cover_sub": ParagraphStyle("CoverSub", parent=_styles["Normal"],
                                    fontSize=11, textColor=rl(brand["grey"]), alignment=TA_CENTER,
                                    fontName=font_body),
        "h2": ParagraphStyle("H2", parent=_styles["Heading2"],
                              textColor=rl(brand["primary"]), fontSize=13,
                              spaceBefore=4, spaceAfter=6, fontName=font_heading),
        "body": ParagraphStyle("Body2", parent=_styles["Normal"],
                                fontSize=9.5, leading=14, textColor=colors.HexColor("#333333"),
                                fontName=font_body),
        "kpi_label": ParagraphStyle("KpiLabel", parent=_styles["Normal"],
                                     fontSize=8.5, textColor=rl(brand["grey"]), alignment=TA_CENTER,
                                     fontName=font_body),
        "kpi_value": ParagraphStyle("KpiValue", parent=_styles["Normal"],
                                     fontSize=20, textColor=rl(brand["primary"]),
                                     alignment=TA_CENTER, fontName=font_heading),
        "timeline_date": ParagraphStyle("TimelineDate", parent=_styles["Normal"],
                                        fontSize=7.5, leading=9, textColor=rl(brand["grey"]),
                                        alignment=TA_CENTER, fontName=font_body),
        "timeline_label": ParagraphStyle("TimelineLabel", parent=_styles["Normal"],
                                         fontSize=8.5, leading=10, textColor=rl(brand["primary"]),
                                         alignment=TA_CENTER, fontName=font_heading),
        "timeline_detail": ParagraphStyle("TimelineDetail", parent=_styles["Normal"],
                                          fontSize=7.5, leading=9, textColor=colors.HexColor("#333333"),
                                          alignment=TA_CENTER, fontName=font_body),
    }


def _table_flowable(table_spec, brand):
    font_body = brand.get("font_body", "Helvetica")
    font_heading = brand.get("font_heading", "Helvetica-Bold")
    data = [table_spec["headers"]] + table_spec["rows"]
    t = Table(data, colWidths=table_spec.get("col_widths"))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), rl(brand["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, 0), font_heading),
        ("FONTNAME", (0, 1), (-1, -1), font_body),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, rl(brand["light_bg"])]),
        ("GRID", (0, 0), (-1, -1), 0.5, rl(brand["border"])),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


# ---------------------------------------------------------------- layouts --

def layout_cover(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    return [
        Spacer(1, 4 * cm),
        Paragraph(spec["title"], s["title"]),
        Spacer(1, 0.3 * cm),
        Paragraph(spec.get("subtitle", ""), s["cover_sub"]),
        Spacer(1, 0.2 * cm),
        Paragraph(spec.get("meta", ""), s["cover_sub"]),
    ]


def layout_full_chart(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    if spec.get("body"):
        out += [Paragraph(spec["body"], s["body"]), Spacer(1, 0.2 * cm)]
    path = render_chart(spec["chart"], brand, chart_dir, f"chart_{idx}")
    out.append(Image(path, width=16 * cm, height=7.1 * cm))
    return out


def layout_two_col_charts(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    p1 = render_chart(spec["charts"][0], brand, chart_dir, f"chart_{idx}_a")
    p2 = render_chart(spec["charts"][1], brand, chart_dir, f"chart_{idx}_b")
    out.append(Table(
        [[Image(p1, width=7.6 * cm, height=6.5 * cm), Image(p2, width=7.6 * cm, height=6.5 * cm)]],
        colWidths=[8 * cm, 8 * cm]
    ))
    return out


def layout_three_col_charts(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    paths = [render_chart(c, brand, chart_dir, f"chart_{idx}_{i}")
             for i, c in enumerate(spec["charts"])]
    imgs = [Image(p, width=5.1 * cm, height=4.6 * cm) for p in paths]
    out.append(Table([imgs], colWidths=[5.3 * cm] * len(imgs)))
    return out


def layout_chart_with_table(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    path = render_chart(spec["chart"], brand, chart_dir, f"chart_{idx}")
    out.append(Image(path, width=16 * cm, height=7.1 * cm))
    out.append(Spacer(1, 0.3 * cm))
    out.append(_table_flowable(spec["table"], brand))
    return out


def layout_kpi_grid(spec, brand, chart_dir, idx):
    """spec['kpis'] = [{"label":..., "value":..., "delta":"+4.1%"}, ...] (3-5 items look best)"""
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    cells = []
    for k in spec["kpis"]:
        delta = k.get("delta", "")
        cell = [
            Paragraph(k["label"], s["kpi_label"]),
            Paragraph(str(k["value"]), s["kpi_value"]),
            Paragraph(delta, s["kpi_label"]),
        ]
        cells.append(cell)
    # transpose into a single-row table of stacked mini-tables
    from reportlab.platypus import Table as T
    inner_cells = []
    for cell in cells:
        mini = T([[c] for c in cell])
        mini.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        inner_cells.append(mini)
    width = 16 / len(inner_cells)
    grid = T([inner_cells], colWidths=[width * cm] * len(inner_cells))
    grid.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, rl(brand["border"])),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, rl(brand["border"])),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    out.append(grid)
    return out


def layout_table_only(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    out = [Paragraph(spec["heading"], s["h2"])]
    if spec.get("body"):
        out += [Paragraph(spec["body"], s["body"]), Spacer(1, 0.2 * cm)]
    out.append(_table_flowable(spec["table"], brand))
    return out


def layout_text_block(spec, brand, chart_dir, idx):
    s = _styles_for(brand)
    return [Paragraph(spec["heading"], s["h2"]), Paragraph(spec["body"], s["body"])]


def _timeline_marker(brand, color):
    drawing = Drawing(2.35 * cm, 0.55 * cm)
    y = 0.28 * cm
    drawing.add(Line(0, y, 2.35 * cm, y, strokeColor=rl(brand["border"]), strokeWidth=1.2))
    drawing.add(Circle(1.175 * cm, y, 0.11 * cm, fillColor=rl(color), strokeColor=colors.white, strokeWidth=1.5))
    return drawing


def layout_timeline(spec, brand, chart_dir, idx):
    """spec['events'] = [{"date": "...", "label": "...", "detail": "...", "severity": "normal|warning|high"}, ...]"""
    s = _styles_for(brand)
    events = spec["events"]
    if not events:
        raise ValueError("timeline layout requires at least one event")
    out = [Paragraph(spec["heading"], s["h2"])]
    if spec.get("body"):
        out += [Paragraph(spec["body"], s["body"]), Spacer(1, 0.25 * cm)]

    def event_color(event):
        severity = event.get("severity", "normal")
        if severity == "high":
            return brand["danger"]
        if severity == "warning":
            return brand["accent2"]
        return brand["primary"]

    dates = [Paragraph(str(event.get("date", "")), s["timeline_date"]) for event in events]
    markers = [_timeline_marker(brand, event_color(event)) for event in events]
    labels = [Paragraph(str(event.get("label", "")), s["timeline_label"]) for event in events]
    details = [Paragraph(str(event.get("detail", "")), s["timeline_detail"]) for event in events]
    col_width = 16 / len(events)
    table = Table([dates, markers, labels, details], colWidths=[col_width * cm] * len(events))
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))
    out.append(table)
    return out


# Registry: Qwen's page_spec["layout"] string -> builder function
LAYOUTS = {
    "cover": layout_cover,
    "full_chart": layout_full_chart,
    "two_col_charts": layout_two_col_charts,
    "three_col_charts": layout_three_col_charts,
    "chart_with_table": layout_chart_with_table,
    "kpi_grid": layout_kpi_grid,
    "table_only": layout_table_only,
    "text_block": layout_text_block,
    "timeline": layout_timeline,
}


def build_page(page_spec, brand, chart_dir, idx):
    fn = LAYOUTS.get(page_spec["layout"])
    if fn is None:
        raise ValueError(f"Unknown layout '{page_spec['layout']}'. Valid: {list(LAYOUTS)}")
    flowables = fn(page_spec, brand, chart_dir, idx)
    flowables.append(PageBreak())
    return flowables
