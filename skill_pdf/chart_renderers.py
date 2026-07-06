"""
Chart renderers. Each function takes:
    spec  -> dict describing the data (comes from Qwen's JSON output)
    brand -> dict from brand.py
    outpath -> where to save the PNG
and returns outpath.

Qwen never draws pixels. It only ever produces `spec` dicts that match
the shapes documented in each docstring. This file is the single source
of truth for what a chart LOOKS like.
"""
import os
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.colors import LinearSegmentedColormap

FULL_W, FULL_H = 6.3, 2.8     # inches, fits full-width on A4 with margins
HALF_W, HALF_H = 4.2, 3.4     # inches, fits two-up side by side

plt.rcParams.update({
    "font.size": 10,
    "axes.edgecolor": "#444444",
    "axes.labelcolor": "#222222",
    "text.color": "#222222",
    "xtick.color": "#444444",
    "ytick.color": "#444444",
})


def _new_fig(half=False):
    size = (HALF_W, HALF_H) if half else (FULL_W, FULL_H)
    return plt.subplots(figsize=size)


def _finish(fig, outpath):
    plt.tight_layout()
    fig.savefig(outpath, dpi=180)
    plt.close(fig)
    return outpath


def render_line(spec, brand, outpath):
    """
    spec = {
      "title": str,
      "x": [labels or ISO datetimes],
      "series": {"Inbound": [num,...], "Outbound": [num,...]},
      "x_is_datetime": bool (optional, default False)
    }
    """
    fig, ax = _new_fig(half=spec.get("half", False))
    palette = brand["palette"]
    x = spec["x"]
    if spec.get("x_is_datetime"):
        import datetime as dt
        x = [dt.datetime.fromisoformat(v) for v in x]
    for i, (name, ys) in enumerate(spec["series"].items()):
        ax.plot(x, ys, label=name, color=palette[i % len(palette)], linewidth=2)
    if spec.get("x_is_datetime"):
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    if len(spec["series"]) > 1:
        ax.legend(frameon=False, fontsize=8)
    ax.spines[['top', 'right']].set_visible(False)
    return _finish(fig, outpath)


def render_bar(spec, brand, outpath):
    """
    spec = {"title": str, "labels": [...], "values": [...], "highlight_last": bool (optional)}
    Vertical bar chart.
    """
    fig, ax = _new_fig(half=spec.get("half", False))
    colors_list = [brand["primary"]] * len(spec["labels"])
    if spec.get("highlight_last"):
        colors_list[-1] = brand["accent2"]
    ax.bar(spec["labels"], spec["values"], color=colors_list)
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    ax.spines[['top', 'right']].set_visible(False)
    return _finish(fig, outpath)


def render_barh(spec, brand, outpath):
    """
    spec = {"title": str, "labels": [...], "values": [...], "highlight_top": bool (optional)}
    Horizontal bar, values shown, largest on top.
    """
    fig, ax = _new_fig(half=spec.get("half", False))
    labels = spec["labels"][::-1]
    values = spec["values"][::-1]
    colors_list = [brand["primary"]] * len(labels)
    if spec.get("highlight_top"):
        colors_list[-1] = brand["accent2"]
    bars = ax.barh(labels, values, color=colors_list)
    for i, v in enumerate(values):
        ax.text(v + max(values) * 0.01, i, f"{v:,}", va="center", fontsize=8, color="#444")
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    ax.spines[['top', 'right']].set_visible(False)
    return _finish(fig, outpath)


def render_pie(spec, brand, outpath):
    """
    spec = {"title": str, "labels": [...], "values": [...], "donut": bool (optional, default True)}
    """
    fig, ax = plt.subplots(figsize=(HALF_W, HALF_H + 0.2))
    palette = brand["palette"]
    donut = spec.get("donut", True)
    ax.pie(
        spec["values"], labels=spec["labels"], autopct="%1.0f%%",
        colors=palette[:len(spec["values"])], startangle=90,
        wedgeprops=dict(width=0.42 if donut else 1.0, edgecolor="white"),
        textprops={"fontsize": 8},
    )
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold")
    return _finish(fig, outpath)


def render_stacked_area(spec, brand, outpath):
    """
    spec = {"title": str, "x": [...], "series": {"Low":[...], "Medium":[...], "High":[...]}}
    """
    fig, ax = _new_fig(half=spec.get("half", False))
    palette = brand["palette"]
    names = list(spec["series"].keys())
    values = list(spec["series"].values())
    ax.stackplot(spec["x"], *values, labels=names, colors=palette[:len(names)])
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    ax.legend(loc="upper left", frameon=False, fontsize=8, ncol=len(names))
    ax.spines[['top', 'right']].set_visible(False)
    return _finish(fig, outpath)


def render_grouped_bar(spec, brand, outpath):
    """
    spec = {"title": str, "labels": [...], "series": {"This Month":[...], "Last Month":[...]}}
    """
    import numpy as np
    fig, ax = _new_fig(half=spec.get("half", False))
    palette = brand["palette"]
    names = list(spec["series"].keys())
    n = len(names)
    x = np.arange(len(spec["labels"]))
    width = 0.8 / n
    for i, name in enumerate(names):
        ax.bar(x + i * width - 0.4 + width / 2, spec["series"][name], width,
               label=name, color=palette[i % len(palette)])
    ax.set_xticks(x)
    ax.set_xticklabels(spec["labels"])
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    ax.legend(frameon=False, fontsize=8)
    ax.spines[['top', 'right']].set_visible(False)
    return _finish(fig, outpath)


def render_heatmap(spec, brand, outpath):
    """
    spec = {
      "title": str,
      "x": ["00:00", "01:00", ...],       # hours across columns
      "y": ["Mon", "Tue", ...],           # days down rows
      "values": [[num, ...], ...],         # len(y) rows × len(x) columns
      "unit": str (optional)
    }
    Traffic volume heatmap by hour (x) × day (y).
    """
    import numpy as np
    values = np.array(spec["values"], dtype=float)
    if values.shape != (len(spec["y"]), len(spec["x"])):
        raise ValueError(
            f"heatmap values shape {values.shape} must be (len(y), len(x)) "
            f"= ({len(spec['y'])}, {len(spec['x'])})"
        )

    fig, ax = _new_fig(half=spec.get("half", False))
    cmap = LinearSegmentedColormap.from_list(
        "brand_heatmap",
        [brand["light_bg"], brand["accent"], brand["primary"]],
    )
    img = ax.imshow(values, aspect="auto", cmap=cmap)
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left")
    ax.set_xticks(range(len(spec["x"])))
    ax.set_xticklabels(spec["x"], rotation=45, ha="right", fontsize=7)
    ax.set_yticks(range(len(spec["y"])))
    ax.set_yticklabels(spec["y"], fontsize=8)
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    cbar = fig.colorbar(img, ax=ax, fraction=0.035, pad=0.02)
    cbar.ax.tick_params(labelsize=7)
    if spec.get("unit"):
        cbar.set_label(spec["unit"], fontsize=8)
    return _finish(fig, outpath)


def render_gauge(spec, brand, outpath):
    """
    spec = {
      "title": str,
      "value": num,
      "min": num (optional, default 0),
      "max": num (optional, default 100),
      "threshold": num (optional, default 80),
      "unit": str (optional, default "%")
    }
    Semicircle gauge for one KPI vs threshold.
    """
    from matplotlib.patches import Wedge, Circle
    min_value = float(spec.get("min", 0))
    max_value = float(spec.get("max", 100))
    value = float(spec["value"])
    threshold = float(spec.get("threshold", max_value * 0.8))
    unit = spec.get("unit", "%")
    span = max(max_value - min_value, 1)
    clipped = min(max(value, min_value), max_value)
    threshold_clipped = min(max(threshold, min_value), max_value)
    value_ratio = (clipped - min_value) / span
    threshold_ratio = (threshold_clipped - min_value) / span
    value_angle = 180 - 180 * value_ratio
    threshold_angle = 180 - 180 * threshold_ratio
    status_color = brand["danger"] if value >= threshold else brand["accent2"]

    fig, ax = _new_fig(half=spec.get("half", False))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold", loc="left", pad=8)
    ax.add_patch(Wedge((0, 0), 1.0, 0, 180, width=0.18, facecolor=brand["light_bg"], edgecolor="none"))
    ax.add_patch(Wedge((0, 0), 1.0, value_angle, 180, width=0.18, facecolor=status_color, edgecolor="none"))
    ax.plot(
        [0, 0.95 * math.cos(math.radians(threshold_angle))],
        [0, 0.95 * math.sin(math.radians(threshold_angle))],
        color=brand["primary"], linewidth=1.2, linestyle="--",
    )
    ax.add_patch(Circle((0, 0), 0.035, color=brand["primary"]))
    ax.text(0, 0.24, f"{value:g}{unit}", ha="center", va="center",
            fontsize=24, fontweight="bold", color=brand["primary"])
    ax.text(0, -0.03, f"Threshold {threshold:g}{unit}", ha="center", va="center",
            fontsize=9, color=brand["grey"])
    ax.text(-1.0, -0.16, f"{min_value:g}{unit}", ha="left", va="center", fontsize=8, color=brand["grey"])
    ax.text(1.0, -0.16, f"{max_value:g}{unit}", ha="right", va="center", fontsize=8, color=brand["grey"])
    ax.set_xlim(-1.15, 1.15)
    ax.set_ylim(-0.22, 1.18)
    return _finish(fig, outpath)


# Registry Qwen's "type" field maps into — add new chart types here only.
RENDERERS = {
    "line": render_line,
    "bar": render_bar,
    "barh": render_barh,
    "pie": render_pie,
    "stacked_area": render_stacked_area,
    "grouped_bar": render_grouped_bar,
    "heatmap": render_heatmap,
    "gauge": render_gauge,
}


def render_chart(spec, brand, outdir, name):
    """Dispatch by spec['type'] and return the saved file path."""
    fn = RENDERERS.get(spec["type"])
    if fn is None:
        raise ValueError(f"Unknown chart type '{spec['type']}'. Valid: {list(RENDERERS)}")
    outpath = os.path.join(outdir, f"{name}.png")
    return fn(spec, brand, outpath)
