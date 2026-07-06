"""
Brand/theme configuration for report templates.
Change ONE dict here to re-skin every chart + PDF page — Qwen never touches this.
"""
from pathlib import Path
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = Path(__file__).resolve().parent / "fonts"


def _register_ttf(font_name, filename):
    path = FONT_DIR / filename
    if not path.exists():
        return None
    if font_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(font_name, str(path)))
    return font_name


SARABUN_REGULAR = _register_ttf("Sarabun", "Sarabun-Regular.ttf")
SARABUN_BOLD = _register_ttf("Sarabun-Bold", "Sarabun-Bold.ttf")

NT_BRAND = {
    "name": "NT Yellow/Navy",
    "primary": "#1B1F3B",     # navy - headings, primary chart color
    "accent": "#FEE74A",      # NT yellow - highlight bar/wedge
    "accent2": "#E0B400",     # darker yellow, better contrast on white print
    "danger": "#C0392B",
    "grey": "#6B7280",
    "light_bg": "#F4F5F7",
    "border": "#DDDDDD",
    # ordered palette used for multi-series charts (bar groups, pies, stacks)
    "palette": ["#1B1F3B", "#E0B400", "#7C86A8", "#B0B7C6", "#D9DCE3", "#C0392B"],
    "font_heading": "Helvetica-Bold",
    "font_body": "Helvetica",
}

# Example of a second brand — swap brand=CORPORATE_BLUE in build_pdf() to re-skin instantly
CORPORATE_BLUE = {
    "name": "Corporate Blue",
    "primary": "#0B2E4F",
    "accent": "#2E86AB",
    "accent2": "#1D6A8C",
    "danger": "#B23A48",
    "grey": "#5A6472",
    "light_bg": "#F2F6F9",
    "border": "#E1E6EA",
    "palette": ["#0B2E4F", "#2E86AB", "#8FB8D6", "#C7D9E5", "#E7EDF2", "#B23A48"],
    "font_heading": "Helvetica-Bold",
    "font_body": "Helvetica",
}

THAI_NT_BRAND = {
    **NT_BRAND,
    "name": "NT Yellow/Navy Thai",
    "font_heading": SARABUN_BOLD or NT_BRAND["font_heading"],
    "font_body": SARABUN_REGULAR or NT_BRAND["font_body"],
}

def rl(hexstr):
    """hex string -> reportlab Color"""
    return colors.HexColor(hexstr)
