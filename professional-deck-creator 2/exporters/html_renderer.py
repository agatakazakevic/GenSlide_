"""
HTML renderer for multi-agent slide output.
Creates a single self-contained HTML file with Chart.js charts.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, Dict, List


def _build_layout_index(layouts: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    layout_by_slide: Dict[int, Dict[str, Any]] = {}
    for layout in layouts:
        key = layout.get("slide_number")
        if isinstance(key, (int, str)):
            layout_by_slide[int(key)] = layout
    return layout_by_slide


def _normalize_content(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        result: List[str] = []
        for item in value:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                result.append(
                    item.get("text") or item.get("content") or str(item)
                )
            else:
                result.append(str(item))
        return result
    return []


def _extract_slide_inputs(
    slide: Dict[str, Any],
    idx: int,
    layouts: List[Dict[str, Any]],
    layout_by_slide: Dict[int, Dict[str, Any]],
) -> Dict[str, Any]:
    slide_num = slide.get("slide_number", idx + 1)
    layout_spec = layout_by_slide.get(slide_num) or (layouts[idx] if idx < len(layouts) else {})
    layout_type = layout_spec.get("layout_type", "single_column_text")

    title = str(slide.get("title") or "")
    subtitle = str(slide.get("subtitle") or "")
    content = _normalize_content(slide.get("content"))

    chart = None
    chart_raw = slide.get("chart")
    if isinstance(chart_raw, dict):
        if isinstance(chart_raw.get("chart_spec"), dict):
            chart = chart_raw.get("chart_spec")
        elif any(key in chart_raw for key in ("chart_type", "labels", "data", "datasets")):
            chart = chart_raw
        elif isinstance(chart_raw.get("config"), dict):
            cfg = chart_raw.get("config", {})
            labels = cfg.get("data", {}).get("labels", []) if isinstance(cfg.get("data"), dict) else []
            datasets = cfg.get("data", {}).get("datasets", []) if isinstance(cfg.get("data"), dict) else []
            series = datasets[0] if datasets and isinstance(datasets[0], dict) else {}
            chart = {
                "chart_type": cfg.get("type", "bar"),
                "labels": labels,
                "data": series.get("data", []),
                "series_name": series.get("label", "Value"),
            }
    elif isinstance(slide.get("chart_spec"), dict):
        chart = slide.get("chart_spec")

    chart_id = f"chart-{idx + 1}" if chart else None

    # Preserve structured content fields from the content writer
    structured: Dict[str, Any] = {}
    for key in (
        "left_items", "right_items", "left_label", "right_label",
        "comparison_axis", "headline_insight", "explanation",
        "content_type",
    ):
        val = slide.get(key)
        if val:
            structured[key] = val

    # Preserve layout positioning data from the layout agent
    element_positions = layout_spec.get("element_positions", {})
    spacing = layout_spec.get("spacing", {})
    visual_hierarchy = layout_spec.get("visual_hierarchy", {})

    return {
        "slide_number": slide_num,
        "layout_type": layout_type,
        "title": title,
        "subtitle": subtitle,
        "content": content,
        "chart": chart,
        "chart_id": chart_id,
        "structured": structured,
        "element_positions": element_positions,
        "spacing": spacing,
        "visual_hierarchy": visual_hierarchy,
    }


def _build_slides_spec(
    slides: List[Dict[str, Any]],
    layouts: List[Dict[str, Any]],
    layout_by_slide: Dict[int, Dict[str, Any]],
    primary_hex: str,
    secondary_hex: str,
    accent_hex: str,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    slides_spec: List[Dict[str, Any]] = []
    chart_configs: List[Dict[str, Any]] = []
    chart_layouts = {"chart", "full_chart", "two_column_text_chart"}
    for idx, slide in enumerate(slides):
        spec = _extract_slide_inputs(slide, idx, layouts, layout_by_slide)
        if not spec["chart"] and str(spec["layout_type"]).strip().lower() in chart_layouts:
            spec["chart"] = _build_fallback_chart_spec(
                title=spec.get("title", ""),
                content=spec.get("content", []),
            )
            spec["chart_id"] = f"chart-{idx + 1}"
        if spec["chart"] and spec["chart_id"]:
            chart_configs.append(_chart_to_js(spec["chart"], spec["chart_id"], primary_hex, secondary_hex, accent_hex))
        slides_spec.append({
            "slide_number": spec["slide_number"],
            "layout_type": spec["layout_type"],
            "title": spec["title"],
            "subtitle": spec["subtitle"],
            "content": spec["content"],
            "chart_id": spec["chart_id"],
            "chart_spec": spec["chart"],
            "structured": spec.get("structured", {}),
            "element_positions": spec.get("element_positions", {}),
            "spacing": spec.get("spacing", {}),
            "visual_hierarchy": spec.get("visual_hierarchy", {}),
        })
    return slides_spec, chart_configs


def _build_theme_spec(
    bg_hex: str,
    primary_hex: str,
    secondary_hex: str,
    accent_hex: str,
    text_white: str,
    text_light: str,
    text_muted: str,
    text_dim: str,
    font_title: str,
    font_body: str,
    is_dark: bool,
    gradient_primary: str,
) -> Dict[str, Any]:
    return {
        "colors": {
            "background": bg_hex,
            "primary": primary_hex,
            "secondary": secondary_hex,
            "accent": accent_hex,
            "text_white": text_white,
            "text_light": text_light,
            "text_muted": text_muted,
            "text_dim": text_dim,
        },
        "fonts": {
            "title": font_title,
            "body": font_body,
        },
        "is_dark": is_dark,
        "gradients": {
            "primary": gradient_primary,
        },
        "shadows": {
            "glow": "0 0 60px rgba(0,0,0,0.12), 0 0 100px rgba(0,0,0,0.08)",
            "card": "0 4px 24px rgba(0,0,0,0.2)",
        },
        "slide_size": {
            "width": 1920,
            "height": 1080,
        },
    }


class HTMLRenderer:
    def __init__(
        self,
        template_style: Dict[str, Any],
        llm_client: Any | None = None,
    ):
        """
        Initialize HTML renderer.

        Args:
            template_style: Style configuration (colors, fonts)
            llm_client: LLM client for per-slide agentic rendering (required)
        """
        self.style = template_style or {}
        self.llm_client = llm_client
        try:
            parsed = int(str(os.getenv("HTML_AGENTIC_MAX_CONCURRENCY", "4")).strip())
        except (TypeError, ValueError):
            parsed = 4
        self.max_slide_concurrency = max(1, min(parsed, 8))

    async def render(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        output_path: str,
    ) -> str:
        """Render slides to HTML using per-slide agentic mode."""
        if not self.llm_client:
            raise RuntimeError("LLM client is required for HTML rendering.")

        slides = content_structure.get("slides", [])
        layout_by_slide = _build_layout_index(layouts)

        colors = self.style.get("colors", {})
        primary = colors.get("primary", (33, 102, 172))
        secondary = colors.get("secondary", (96, 170, 255))
        accent = colors.get("accent", (240, 176, 0))

        primary_hex = _rgb_tuple_to_hex(primary)
        secondary_hex = _rgb_tuple_to_hex(secondary)
        accent_hex = _rgb_tuple_to_hex(accent)

        font_title = self.style.get("fonts", {}).get("title", "Inter")
        font_body = self.style.get("fonts", {}).get("body", "Inter")

        style_id = self.style.get("id", "")
        mode = str(self.style.get("mode") or "").strip().lower()
        if mode in {"dark", "light"}:
            is_dark = mode == "dark"
        else:
            is_dark = style_id in {"modern", "bold", "wecommit"}

        # Resolve background color
        bg_tuple = colors.get("background", (255, 255, 255))
        backgrounds = self.style.get("backgrounds", {}) if isinstance(self.style, dict) else {}
        content_bg = backgrounds.get("content", {}) if isinstance(backgrounds, dict) else {}
        if isinstance(content_bg, dict) and content_bg.get("color"):
            bg_tuple = content_bg.get("color")
        elif isinstance(colors, dict) and colors.get("background"):
            bg_tuple = colors.get("background")
        else:
            bg_tuple = (10, 10, 15) if is_dark else (255, 255, 255)
        bg_hex = _rgb_tuple_to_hex(bg_tuple)

        text_white = "#ffffff" if is_dark else "#0f172a"
        text_light = "#e2e8f0" if is_dark else "#1f2937"
        text_muted = "#94a3b8" if is_dark else "#6b7280"
        text_dim = "#64748b" if is_dark else "#9ca3af"

        gradient_primary = f"linear-gradient(135deg, {primary_hex} 0%, {secondary_hex} 50%, {accent_hex} 100%)"
        if isinstance(self.style.get("gradients"), dict) and self.style.get("gradients", {}).get("primary"):
            gradient_primary = str(self.style["gradients"]["primary"])

        theme_spec = _build_theme_spec(
            bg_hex=bg_hex,
            primary_hex=primary_hex,
            secondary_hex=secondary_hex,
            accent_hex=accent_hex,
            text_white=text_white,
            text_light=text_light,
            text_muted=text_muted,
            text_dim=text_dim,
            font_title=font_title,
            font_body=font_body,
            is_dark=is_dark,
            gradient_primary=gradient_primary,
        )

        slides_spec, chart_configs = _build_slides_spec(
            slides=slides,
            layouts=layouts,
            layout_by_slide=layout_by_slide,
            primary_hex=primary_hex,
            secondary_hex=secondary_hex,
            accent_hex=accent_hex,
        )
        layout_sequence = [
            str(spec.get("layout_type", "")).strip().lower() for spec in slides_spec
        ]

        slide_docs: List[str] = []
        slide_dir = f"{os.path.splitext(output_path)[0]}_slides"
        os.makedirs(slide_dir, exist_ok=True)
        semaphore = asyncio.Semaphore(self.max_slide_concurrency)

        async def _render_one_slide(idx: int, spec: Dict[str, Any]) -> Dict[str, Any]:
            slide_num = int(spec.get("slide_number", idx + 1) or idx + 1)
            original_slide = slides[idx] if idx < len(slides) else {}
            qa_feedback = original_slide.get("visual_qa_feedback")
            variety_hint = _build_variety_hint(
                str(spec.get("layout_type", "")).strip().lower(),
                layout_sequence[:idx],
            )

            async with semaphore:
                slide_html_doc = await _render_slide_html_agentic_document(
                    llm_client=self.llm_client,
                    slide_index=slide_num,
                    layout_type=spec.get("layout_type", "single_column_text"),
                    title=spec.get("title", ""),
                    subtitle=spec.get("subtitle", ""),
                    content=spec.get("content", []),
                    chart_id=spec.get("chart_id"),
                    chart_spec=spec.get("chart_spec"),
                    theme=theme_spec,
                    qa_feedback=qa_feedback,
                    structured=spec.get("structured", {}),
                    element_positions=spec.get("element_positions", {}),
                    spacing=spec.get("spacing", {}),
                    visual_hierarchy=spec.get("visual_hierarchy", {}),
                    variety_hint=variety_hint,
                )
            return {
                "idx": idx,
                "slide_number": slide_num,
                "html": slide_html_doc,
            }

        rendered_slides = await asyncio.gather(
            *[_render_one_slide(idx, spec) for idx, spec in enumerate(slides_spec)]
        )
        rendered_slides.sort(key=lambda item: (item["slide_number"], item["idx"]))

        for item in rendered_slides:
            slide_num = int(item["slide_number"])
            slide_html_doc = str(item["html"] or "")
            slide_docs.append(slide_html_doc)
            slide_name = f"slide-{slide_num:02d}.html"
            slide_path = os.path.join(slide_dir, slide_name)
            with open(slide_path, "w", encoding="utf-8") as f:
                f.write(slide_html_doc)

        combined_html = _combine_slide_documents(
            topic=content_structure.get("topic", "AI Deck"),
            slide_docs=slide_docs,
            charts=chart_configs,
            theme=theme_spec,
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(combined_html)
        return output_path


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _coerce_numeric_value(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        token = value.replace(",", "").strip()
        match = re.search(r"[-+]?\d+(?:\.\d+)?", token)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                return None
        return None
    if isinstance(value, dict):
        for key in ("value", "y", "amount", "metric", "count"):
            if key in value:
                parsed = _coerce_numeric_value(value.get(key))
                if parsed is not None:
                    return parsed
        return None
    return None


def _extract_numeric_series(chart_spec: Dict[str, Any]) -> List[float]:
    values: List[float] = []
    data = chart_spec.get("data")
    if isinstance(data, list):
        for item in data:
            parsed = _coerce_numeric_value(item)
            if parsed is not None:
                values.append(parsed)

    if values:
        return values

    datasets = chart_spec.get("datasets")
    if isinstance(datasets, list):
        for dataset in datasets:
            if not isinstance(dataset, dict):
                continue
            ds_data = dataset.get("data")
            if not isinstance(ds_data, list):
                continue
            for item in ds_data:
                parsed = _coerce_numeric_value(item)
                if parsed is not None:
                    values.append(parsed)
            if values:
                return values

    return values


def _normalize_chart_data_for_js(data: Any) -> List[Any]:
    if not isinstance(data, list):
        return []
    normalized: List[Any] = []
    for item in data:
        parsed = _coerce_numeric_value(item)
        normalized.append(parsed if parsed is not None else item)
    return normalized


def _format_chart_context(chart_spec: Dict[str, Any] | None, chart_id: str = "") -> str:
    """Format chart specification into context for the LLM."""
    if not chart_spec:
        return ""

    chart_type = chart_spec.get('chart_type', 'bar')
    labels = chart_spec.get('labels', [])
    data = chart_spec.get('data', [])
    numeric_data = _extract_numeric_series(chart_spec)
    title = chart_spec.get('title', '')
    assumption_note = str(chart_spec.get("assumption_note") or "").strip()
    data_preview_values = numeric_data if numeric_data else (data if isinstance(data, list) else [])
    data_preview = ", ".join(str(d) for d in data_preview_values[:6])
    if len(data_preview_values) > 6:
        data_preview += "..."
    data_min = min(numeric_data) if numeric_data else 0
    data_max = max(numeric_data) if numeric_data else 0

    context = f"""
CHART DATA (to be rendered via Chart.js):
- Chart type: {chart_type}
- Chart title: {title}
- Labels: {', '.join(str(l) for l in labels[:6])}{'...' if len(labels) > 6 else ''}
- Data points: {data_preview}
- Data range: {data_min} to {data_max}

IMPORTANT: The chart will be rendered automatically via Chart.js.
You MUST include exactly this placeholder where the chart should appear:
<div class="chart-slot" data-chart-id="{chart_id}"></div>

Design the surrounding layout to complement the chart:
- If bar/column chart: allocate 50-60% width, ensure height accommodates labels
- If line chart: wide layout (70%+ width) works best
- If pie/doughnut: centered, square aspect ratio area
- Add context around the chart (metrics, highlights, annotations)
"""
    if assumption_note:
        context += f"\n- Assumption note to display near chart: {assumption_note}\n"
    return context


def _build_fallback_chart_spec(title: str, content: List[str]) -> Dict[str, Any]:
    """Create a conservative fallback chart when layout expects chart but data is missing."""
    numeric_values: List[float] = []
    labels: List[str] = []
    number_pattern = re.compile(r"([-+]?\d+(?:\.\d+)?)")

    for item in content:
        if not isinstance(item, str):
            continue
        match = number_pattern.search(item.replace(",", ""))
        if not match:
            continue
        value = float(match.group(1))
        text = item.strip() or ""
        short_label = text[:28] + ("..." if len(text) > 28 else "")
        labels.append(short_label or f"Metric {len(labels) + 1}")
        numeric_values.append(value)
        if len(numeric_values) >= 5:
            break

    if len(numeric_values) < 3:
        numeric_values = [100.0, 135.0, 172.0]
        labels = ["Current", "Mid-term", "Target"]

    return {
        "chart_type": "bar",
        "title": title or "Estimated trend",
        "labels": labels,
        "data": numeric_values,
        "series_name": "Estimated value",
        "assumption_note": "Estimated values generated due missing structured chart data.",
    }


def _chart_to_js(chart_spec: Dict[str, Any], chart_id: str, primary: str, secondary: str, accent: str) -> Dict[str, Any]:
    chart_type = (chart_spec.get("chart_type") or "bar").lower()
    labels = chart_spec.get("labels") or []
    data = _normalize_chart_data_for_js(chart_spec.get("data") or [])
    series_name = chart_spec.get("series_name") or chart_spec.get("axes_labels", {}).get("y", "Value")

    if chart_type in {"column"}:
        chart_type = "bar"
    if chart_type in {"area"}:
        chart_type = "line"

    colors = chart_spec.get("colors") or [primary, secondary, accent]

    config = {
        "type": chart_type,
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "label": series_name,
                    "data": data,
                    "backgroundColor": colors[0],
                    "borderColor": colors[0],
                    "fill": chart_spec.get("chart_type") == "area",
                }
            ],
        },
        "options": {
            "responsive": True,
            "plugins": {
                "legend": {"display": True},
            },
        },
    }

    return {"id": chart_id, "config": config}




def _rgb_tuple_to_hex(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)) and len(value) == 3:
        return "#%02x%02x%02x" % tuple(value)
    return "#222222"


def _map_layout_class(layout_type: str) -> str:
    """Map planner layout types to global layout class names."""
    key = str(layout_type or "").strip().lower()
    mapping = {
        "title_cover": "layout-cover",
        "thanks": "layout-cover",
        "quote": "layout-quote",
        "single_column_text": "layout-basic",
        "summary": "layout-basic",
        "items": "layout-basic",
        "two_column_text_chart": "layout-text-chart",
        "full_chart": "layout-full-chart",
        "chart": "layout-full-chart",
        "three_column_cards": "layout-cards-3",
        "steps": "layout-steps",
        "timeline": "layout-timeline",
        "timeline_horizontal": "layout-timeline",
        "table": "layout-table",
        "concentric_circles": "layout-concentric",
        "comparison": "layout-two-col",
        "split_comparison": "layout-two-col",
        "big_number_stats": "layout-cards-3",
        "big_number": "layout-basic",
        "pyramid": "layout-steps",
        "funnel": "layout-steps",
    }
    return mapping.get(key, "layout-basic")


def _layout_class_variants(base_class: str) -> List[str]:
    """Return variant classes for a given base layout class."""
    variants = {
        "layout-basic": ["layout-basic--accent-left", "layout-basic--boxed"],
        "layout-two-col": ["layout-two-col--reverse", "layout-two-col--accent-left"],
        "layout-text-chart": ["layout-text-chart--reverse", "layout-text-chart--accent"],
        "layout-cards-3": ["layout-cards-3--accent-top", "layout-cards-3--shadow"],
        "layout-steps": ["layout-steps--vertical"],
        "layout-timeline": ["layout-timeline--center"],
        "layout-concentric": ["layout-concentric--stack"],
    }
    return variants.get(base_class, [])


def _select_layout_class(layout_type: str, slide_index: int) -> str:
    """Select a base layout class + optional variant for deterministic variety."""
    base = _map_layout_class(layout_type)
    variants = _layout_class_variants(base)
    if not variants:
        return base
    variant = variants[(max(1, slide_index) - 1) % len(variants)]
    return f"{base} {variant}"


def _build_variety_hint(layout_type: str, prior_layouts: List[str]) -> str:
    """Encourage visual variety when layout types repeat across slides."""
    if not prior_layouts:
        return ""
    recent = [t for t in prior_layouts if isinstance(t, str)]
    if not recent:
        return ""
    last = recent[-1]
    last_two = recent[-2:] if len(recent) >= 2 else recent
    if len(last_two) == 2 and last_two[0] == last_two[1] == layout_type:
        return (
            f"Previous two slides used '{layout_type}'. "
            "Make this slide feel distinct by changing composition, alignment, spacing, "
            "card styles, and background accents while keeping the same layout type."
        )
    if last == layout_type:
        return (
            f"Previous slide used '{layout_type}'. "
            "Vary the visual treatment (different grid proportions, card styling, "
            "alignment, and decorative accents)."
        )
    return ""


def _resolve_layout_key(layout_type: str, mapping: Dict[str, Any]) -> tuple[str | None, Any]:
    if layout_type in mapping:
        return layout_type, mapping[layout_type]
    for key, value in mapping.items():
        if key in layout_type or layout_type in key:
            return key, value
    return None, None


def _get_layout_blueprint(layout_type: str, chart_id: str | None) -> str:
    """Return a minimal HTML skeleton the LLM must follow for a given layout."""
    chart_slot = (
        f'<div class="chart-slot" data-chart-id="{chart_id}"></div>' if chart_id else ""
    )
    blueprints: Dict[str, str] = {
        "single_column_text": """
<div class="slide-header">
  <h1 class="title">...</h1>
  <p class="subtitle">...</p>
</div>
<div class="slide-body">
  <ul class="bullets">
    <li>...</li>
  </ul>
</div>
""",
        "items": """
<div class="slide-header">
  <h1 class="title">...</h1>
</div>
<div class="items-list">
  <div class="item"><div class="item-icon">...</div><div class="item-text">...</div></div>
  <div class="item"><div class="item-icon">...</div><div class="item-text">...</div></div>
</div>
""",
        "thanks": """
<div class="title-block">
  <h1 class="title">...</h1>
  <p class="subtitle">...</p>
</div>
""",
        "summary": """
<div class="slide-header">
  <h1 class="title">...</h1>
</div>
<div class="slide-body">
  <ul class="bullets">
    <li>...</li>
  </ul>
</div>
""",
        "two_column_text_chart": f"""
<div class="layout-grid">
  <div class="col-text">
    <h1 class="title">...</h1>
    <div class="body">
      <ul class="bullets">
        <li>...</li>
      </ul>
    </div>
  </div>
  <div class="col-chart">
    {chart_slot}
  </div>
</div>
""",
        "full_chart": f"""
<div class="layout-stack">
  <div class="header">
    <h1 class="title">...</h1>
    <p class="subtitle">...</p>
  </div>
  <div class="chart-area">
    {chart_slot}
  </div>
</div>
""",
        "chart": f"""
<div class="layout-stack">
  <div class="header">
    <h1 class="title">...</h1>
  </div>
  <div class="chart-area">
    {chart_slot}
  </div>
</div>
""",
        "table": """
<div class="layout-stack">
  <div class="header">
    <h1 class="title">...</h1>
  </div>
  <table class="data-table">
    <thead><tr><th>...</th></tr></thead>
    <tbody><tr><td>...</td></tr></tbody>
  </table>
</div>
""",
        "comparison": """
<div class="layout-grid">
  <div class="col-left">
    <h2 class="col-title">...</h2>
    <ul class="bullets"><li>...</li></ul>
  </div>
  <div class="col-right">
    <h2 class="col-title">...</h2>
    <ul class="bullets"><li>...</li></ul>
  </div>
</div>
""",
        "split_comparison": """
<div class="layout-grid">
  <div class="col-left">
    <h2 class="col-title">...</h2>
    <ul class="bullets"><li>...</li></ul>
  </div>
  <div class="col-right">
    <h2 class="col-title">...</h2>
    <ul class="bullets"><li>...</li></ul>
  </div>
</div>
""",
        "three_column_cards": """
<div class="card-grid">
  <div class="card"><h3>...</h3><p>...</p></div>
  <div class="card"><h3>...</h3><p>...</p></div>
  <div class="card"><h3>...</h3><p>...</p></div>
</div>
""",
        "steps": """
<div class="steps">
  <div class="step"><div class="step-number">1</div><div class="step-body">...</div></div>
  <div class="step"><div class="step-number">2</div><div class="step-body">...</div></div>
</div>
""",
        "timeline": """
<div class="timeline">
  <div class="timeline-item"><div class="time">...</div><div class="event">...</div></div>
  <div class="timeline-item"><div class="time">...</div><div class="event">...</div></div>
</div>
""",
        "timeline_horizontal": """
<div class="timeline">
  <div class="timeline-item"><div class="time">...</div><div class="event">...</div></div>
  <div class="timeline-item"><div class="time">...</div><div class="event">...</div></div>
</div>
""",
        "big_number_stats": """
<div class="stats">
  <div class="stat"><div class="stat-value">...</div><div class="stat-label">...</div></div>
  <div class="stat"><div class="stat-value">...</div><div class="stat-label">...</div></div>
</div>
""",
        "big_number": """
<div class="big-number">
  <div class="stat-value">...</div>
  <div class="stat-label">...</div>
</div>
""",
        "pyramid": """
<div class="pyramid">
  <div class="layer">...</div>
  <div class="layer">...</div>
</div>
""",
        "funnel": """
<div class="pyramid">
  <div class="layer">...</div>
  <div class="layer">...</div>
</div>
""",
        "concentric_circles": """
<div class="circles">
  <div class="circle circle-outer">...</div>
  <div class="circle circle-middle">...</div>
  <div class="circle circle-inner">...</div>
</div>
<div class="legend">
  <div class="legend-item">...</div>
</div>
""",
        "title_cover": """
<div class="title-block">
  <h1 class="title">...</h1>
  <p class="subtitle">...</p>
</div>
""",
        "quote": """
<div class="quote-block">
  <div class="quote">“...”</div>
  <div class="quote-attrib">...</div>
</div>
""",
    }
    _, blueprint = _resolve_layout_key(layout_type, blueprints)
    if not blueprint:
        return ""
    # Remove empty chart slot if chart_id missing
    if not chart_id:
        blueprint = blueprint.replace('{chart_slot}', '').strip()
    return blueprint.strip()


# ---------------------------------------------------------------------------
# Per-slide agentic rendering
# ---------------------------------------------------------------------------


def _evaluate_layout_compliance(html: str, layout_type: str, chart_id: str | None) -> List[str]:
    """Check whether the HTML includes minimal layout-required tokens."""
    issues: List[str] = []
    lower = html.lower()
    # Keep only essential checks to avoid over-constraining layout creativity.
    layout_key = str(layout_type or "").lower()
    if "table" in layout_key and "<table" not in lower:
        issues.append("Layout expects a <table> element.")
    if "concentric" in layout_key and "circle" not in lower:
        issues.append("Layout expects concentric circles (add circle elements or SVG circles).")
    return issues


def _evaluate_slide_document(html: str, slide_id: str, chart_id: str | None, layout_type: str) -> List[str]:
    """Heuristic checks to catch unstable LLM slide outputs before accepting them."""
    issues: List[str] = []
    lower = html.lower()

    if "<html" not in lower or "<head" not in lower or "<body" not in lower:
        issues.append("Document must include html/head/body wrappers.")

    section_matches = re.findall(
        rf"<section[^>]*id=[\"']{re.escape(slide_id)}[\"']",
        html,
        flags=re.IGNORECASE,
    )
    if len(section_matches) != 1:
        issues.append(f"Expected exactly one section with id '{slide_id}'.")

    if chart_id:
        if (
            f'data-chart-id="{chart_id}"' not in html
            and f"data-chart-id='{chart_id}'" not in html
        ):
            issues.append(f"Missing chart placeholder for '{chart_id}'.")
    else:
        if 'class="chart-slot"' in html or "class='chart-slot'" in html or "data-chart-id=" in html:
            issues.append("Chart placeholder found on a non-chart slide.")

    # Too many absolute elements often correlates with overlap/cropping.
    absolute_count = len(re.findall(r"position\s*:\s*absolute", lower))
    if absolute_count > 8:
        issues.append(
            f"Too many absolutely positioned elements ({absolute_count}). "
            "Use flexbox/grid instead. Only decorative elements should be absolute."
        )

    # Extremely large font sizes frequently overflow fixed slides.
    font_px = [
        int(size)
        for size in re.findall(r"font-size\s*:\s*(\d{2,3})px", lower)
        if size.isdigit()
    ]
    if any(size > 96 for size in font_px):
        issues.append("Font sizes above 96px detected (likely overflow).")

    # Very high column counts usually collapse readability in 1920x1080.
    if re.search(r"grid-template-columns\s*:\s*repeat\(\s*(?:[7-9]|\d{2,})", lower):
        issues.append("Grid column count too high for slide width.")

    issues.extend(_evaluate_layout_compliance(html, layout_type, chart_id))

    return issues


def _inject_slide_safety_css(html: str, slide_id: str) -> str:
    """Inject a safety CSS layer for slide sizing/overflow control."""
    if not html:
        return html

    safety_css = f"""
<style id="{slide_id}-layout">
#{slide_id} {{
  width: 1920px !important;
  height: 1080px !important;
  max-width: 1920px !important;
  max-height: 1080px !important;
  overflow: hidden !important;
  position: relative !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 20px;
  padding: 48px 56px;
}}
#{slide_id}, #{slide_id} *, #{slide_id} *::before, #{slide_id} *::after {{
  box-sizing: border-box !important;
}}
#{slide_id} h1, #{slide_id} h2, #{slide_id} h3, #{slide_id} h4, #{slide_id} h5, #{slide_id} h6,
#{slide_id} p, #{slide_id} li, #{slide_id} td, #{slide_id} th, #{slide_id} span {{
  overflow-wrap: anywhere;
  word-break: break-word;
}}
#{slide_id} img, #{slide_id} svg, #{slide_id} canvas, #{slide_id} table {{
  max-width: 100% !important;
}}
#{slide_id} > .slide-body,
#{slide_id} > .layout-grid,
#{slide_id} > .layout-stack,
#{slide_id} > .content,
#{slide_id} > .content-area,
#{slide_id} > .main-content {{
  flex: 1 1 auto !important;
  min-height: 0 !important;
}}
#{slide_id} .layout-grid,
#{slide_id} .layout-stack,
#{slide_id} .content-area,
#{slide_id} .slide-body {{
  min-height: 0 !important;
}}
</style>
"""
    return re.sub(
        r"</head>",
        f"{safety_css}\n</head>",
        html,
        count=1,
        flags=re.IGNORECASE,
    )


def _strip_all_llm_styles(html: str) -> str:
    """Strip ALL CSS from LLM output so only predefined CSS applies.

    Removes:
    - <style> blocks
    - inline style="" attributes (except on <section> which carries CSS vars)
    - <script> tags
    """
    if not html:
        return html
    # Remove <style> blocks entirely
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.IGNORECASE | re.DOTALL)
    # Remove <script> blocks entirely
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.IGNORECASE | re.DOTALL)
    # Remove inline style attributes from all elements EXCEPT <section> (which holds CSS vars)
    # Strategy: replace style="..." on non-section tags
    def _remove_inline_style(match: re.Match) -> str:
        full = match.group(0)
        # Keep style on <section> tags (they carry CSS variables)
        tag_name = match.group(1).lower().strip()
        if tag_name == "section":
            return full
        # Remove the style attribute
        return re.sub(r'\s+style\s*=\s*"[^"]*"', "", full, flags=re.IGNORECASE)

    html = re.sub(
        r"<(\w+)([^>]*\sstyle\s*=\s*\"[^\"]*\"[^>]*)>",
        _remove_inline_style,
        html,
        flags=re.IGNORECASE,
    )
    html = re.sub(
        r"<(\w+)([^>]*\sstyle\s*=\s*'[^']*'[^>]*)>",
        lambda m: m.group(0) if m.group(1).lower().strip() == "section" else re.sub(r"\s+style\s*=\s*'[^']*'", "", m.group(0), flags=re.IGNORECASE),
        html,
        flags=re.IGNORECASE,
    )
    return html


def _sanitize_inline_style(style: str) -> str:
    """Remove size/position properties from inline style strings."""
    if not style:
        return ""
    banned = {
        "width",
        "height",
        "min-width",
        "min-height",
        "max-width",
        "max-height",
        "top",
        "left",
        "right",
        "bottom",
        "position",
        "transform",
    }
    cleaned: List[str] = []
    for decl in style.split(";"):
        decl = decl.strip()
        if not decl:
            continue
        prop = decl.split(":", 1)[0].strip().lower()
        if prop in banned:
            continue
        cleaned.append(decl)
    return "; ".join(cleaned)


def _strip_section_inline_style(html: str, slide_id: str) -> str:
    """Strip size-related inline styles from the slide <section> while preserving CSS vars."""
    if not html:
        return html
    pattern = re.compile(
        rf"(<section\b[^>]*\bid=['\"]{re.escape(slide_id)}['\"][^>]*)(>)",
        flags=re.IGNORECASE,
    )

    def _apply(match: re.Match) -> str:
        tag = match.group(1)
        style_match = re.search(r'\sstyle\s*=\s*"([^"]*)"', tag, flags=re.IGNORECASE)
        if not style_match:
            style_match = re.search(r"\sstyle\s*=\s*'([^']*)'", tag, flags=re.IGNORECASE)
        if not style_match:
            return match.group(0)
        style_val = style_match.group(1)
        cleaned = _sanitize_inline_style(style_val)
        tag = re.sub(r'\sstyle\s*=\s*"[^"]*"', "", tag, flags=re.IGNORECASE)
        tag = re.sub(r"\sstyle\s*=\s*'[^']*'", "", tag, flags=re.IGNORECASE)
        if cleaned:
            tag = f'{tag} style="{cleaned}"'
        return f"{tag}{match.group(2)}"

    return pattern.sub(_apply, html, count=1)


def _strip_inline_size_styles(html: str) -> str:
    """Strip size/position properties from inline styles across the document."""
    if not html:
        return html

    def _replace_style(match: re.Match) -> str:
        style_val = match.group(1)
        cleaned = _sanitize_inline_style(style_val)
        if not cleaned:
            return ""
        return f'style="{cleaned}"'

    html = re.sub(r'style\s*=\s*"([^"]*)"', _replace_style, html, flags=re.IGNORECASE)
    html = re.sub(r"style\s*=\s*'([^']*)'", lambda m: _replace_style(m), html, flags=re.IGNORECASE)
    return html


def _ensure_style_block(html: str) -> str:
    """Ensure the document has a <style> block in <head>."""
    if not html:
        return html
    if re.search(r"<style\b", html, flags=re.IGNORECASE):
        return html
    if re.search(r"</head>", html, flags=re.IGNORECASE):
        return re.sub(
            r"</head>",
            "<style></style>\n</head>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    if re.search(r"<head\b", html, flags=re.IGNORECASE):
        return re.sub(
            r"<head\b[^>]*>",
            lambda m: f"{m.group(0)}\n<style></style>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    if re.search(r"<html\b", html, flags=re.IGNORECASE):
        return re.sub(
            r"<html\b[^>]*>",
            lambda m: f"{m.group(0)}\n<head><style></style></head>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    return html


def _ensure_section_id(html: str, slide_id: str) -> str:
    """Ensure the first <section> has the slide id."""
    if not html:
        return html
    if re.search(rf"<section\b[^>]*\bid=['\"]{re.escape(slide_id)}['\"]", html, flags=re.IGNORECASE):
        return html

    def _apply(match: re.Match) -> str:
        tag = match.group(0)
        tag = re.sub(r"\sid=['\"][^'\"]*['\"]", "", tag, flags=re.IGNORECASE)
        return f"{tag[:-1]} id=\"{slide_id}\">"

    return re.sub(r"<section\b[^>]*>", _apply, html, count=1, flags=re.IGNORECASE)


def _normalize_slide_document(html: str, slide_id: str, layout_class: str) -> str:
    """Coerce LLM output into a full HTML document with a valid slide section."""
    if not html:
        return ""
    html_lower = html.lower()
    if "<html" not in html_lower or "<body" not in html_lower:
        body = html
        if "<section" not in html_lower:
            body = f'<section id="{slide_id}" class="slide {layout_class}">{body}</section>'
        html = (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/>"
            "<style></style></head><body>"
            f"{body}</body></html>"
        )
    html = _ensure_style_block(html)
    html = _ensure_section_id(html, slide_id)
    return html


def _build_min_table(content: List[str]) -> str:
    headers = ["Item", "Detail"]
    rows = []
    for item in content[:6]:
        text = str(item).strip()
        if ":" in text:
            left, right = text.split(":", 1)
            rows.append((left.strip(), right.strip()))
        else:
            rows.append((text, ""))
    if not rows:
        rows = [("Metric A", "Value"), ("Metric B", "Value")]
    thead = "<thead><tr>" + "".join(f"<th>{_escape_html(h)}</th>" for h in headers) + "</tr></thead>"
    tbody = "<tbody>" + "".join(
        f"<tr><td>{_escape_html(l)}</td><td>{_escape_html(r)}</td></tr>" for l, r in rows
    ) + "</tbody>"
    return f'<table class="data-table">{thead}{tbody}</table>'


def _inject_required_structure(
    html: str,
    slide_id: str,
    layout_type: str,
    chart_id: str | None,
    content: List[str],
) -> str:
    """Auto-inject missing structural elements for strict layouts."""
    if not html:
        return html
    lower = html.lower()
    injected = False

    if chart_id and f'data-chart-id="{chart_id}"' not in lower and f"data-chart-id='{chart_id}'" not in lower:
        chart_slot = f'<div class="chart-slot" data-chart-id="{chart_id}"></div>'
        html = re.sub(r"</section>", f"{chart_slot}\n</section>", html, count=1, flags=re.IGNORECASE)
        lower = html.lower()
        injected = True

    if "table" in layout_type.lower() and "<table" not in lower:
        table_html = _build_min_table(content)
        html = re.sub(r"</section>", f"{table_html}\n</section>", html, count=1, flags=re.IGNORECASE)
        injected = True

    if injected:
        html = _ensure_section_id(html, slide_id)
    return html


def _missing_required_structure(issues: List[str]) -> bool:
    for issue in issues:
        if "Layout '" in issue or "Missing chart placeholder" in issue:
            return True
    return False


def _build_fallback_slide_html(
    slide_id: str,
    layout_class: str,
    title: str,
    subtitle: str,
    content: List[str],
    chart_id: str | None,
    layout_type: str,
) -> str:
    bullets = "".join(f"<li>{_escape_html(item)}</li>" for item in content[:6])
    chart_slot = f'<div class="chart-slot" data-chart-id="{chart_id}"></div>' if chart_id else ""
    table_html = _build_min_table(content) if "table" in layout_type.lower() else ""
    body = f"""
<section id="{slide_id}" class="slide {layout_class}">
  <div class="slide-header">
    <h1 class="title">{_escape_html(title)}</h1>
    {f'<p class="subtitle">{_escape_html(subtitle)}</p>' if subtitle else ''}
  </div>
  <div class="slide-body">
    {table_html or chart_slot or f'<ul class="bullets">{bullets}</ul>'}
  </div>
</section>
"""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    #{slide_id} {{
      width: 1920px;
      height: 1080px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 48px 56px;
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }}
    #{slide_id} .slide-body {{ flex: 1; min-height: 0; }}
    #{slide_id} .bullets {{ margin: 0; padding-left: 18px; }}
    #{slide_id} .data-table {{ width: 100%; border-collapse: collapse; }}
    #{slide_id} .data-table th, #{slide_id} .data-table td {{
      border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left;
    }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""


def _enforce_section_class(html: str, slide_id: str, class_value: str) -> str:
    """Force the slide <section> class to a controlled value."""
    if not html:
        return html
    pattern = re.compile(
        rf"(<section\b[^>]*\bid=['\"]{re.escape(slide_id)}['\"][^>]*)(>)",
        flags=re.IGNORECASE,
    )

    def _apply(match: re.Match) -> str:
        tag = match.group(1)
        tag = re.sub(r"\sclass=['\"][^'\"]*['\"]", "", tag, flags=re.IGNORECASE)
        return f"{tag} class=\"{class_value}\"{match.group(2)}"

    return pattern.sub(_apply, html, count=1)


def _build_structured_context(structured: Dict[str, Any]) -> str:
    """Format structured content fields (comparison columns, headline insights, etc.)."""
    if not structured:
        return ""
    parts: List[str] = []
    if structured.get("content_type"):
        parts.append(f"Content type: {structured['content_type']}")
    if structured.get("headline_insight"):
        parts.append(f"Headline insight (display prominently): {structured['headline_insight']}")
    if structured.get("explanation"):
        parts.append(f"Explanation text: {structured['explanation']}")
    if structured.get("left_label") or structured.get("right_label"):
        parts.append(f"Left column label: {structured.get('left_label', 'Option A')}")
        parts.append(f"Right column label: {structured.get('right_label', 'Option B')}")
    if structured.get("left_items"):
        items = structured["left_items"]
        if isinstance(items, list):
            parts.append(f"Left column items: {json.dumps(items, ensure_ascii=False)}")
    if structured.get("right_items"):
        items = structured["right_items"]
        if isinstance(items, list):
            parts.append(f"Right column items: {json.dumps(items, ensure_ascii=False)}")
    if structured.get("comparison_axis"):
        parts.append(f"Comparison axis: {structured['comparison_axis']}")
    return "\n".join(parts)


def _get_global_layout_css() -> str:
    """Comprehensive predefined CSS library using CSS variables for theming.

    ALL visual styling lives here. The LLM writes zero CSS — only HTML with
    the exact class names targeted below.
    """
    return """
/* ================================================================
   GLOBAL LAYOUT LIBRARY — predefined CSS for strict HTML contracts
   All colors/fonts via CSS custom properties set on each <section>.
   ================================================================ */

/* --- Base slide --- */
.slide {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 48px 56px;
  background: var(--bg, #ffffff);
  color: var(--text, #0f172a);
  font-family: var(--font-body, 'Inter', system-ui, sans-serif);
  font-size: 1rem;
  line-height: 1.5;
}

/* --- Slide header (title area) --- */
.slide .slide-header {
  flex-shrink: 0;
}
.slide .slide-header .title,
.slide .title-block .title {
  font-family: var(--font-title, 'Inter', system-ui, sans-serif);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text, #0f172a);
  margin: 0 0 4px 0;
  line-height: 1.2;
}
.slide .slide-header .subtitle {
  font-size: 0.95rem;
  color: var(--text-muted, #6b7280);
  margin: 0;
  line-height: 1.4;
}

/* --- Slide body (content area) --- */
.slide .slide-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* --- Common elements --- */
.slide .bullets {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.slide .bullets li {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-light, #1f2937);
  padding-left: 20px;
  position: relative;
}
.slide .bullets li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary, #2166ac);
}
.slide .col-title {
  font-family: var(--font-title, 'Inter', system-ui, sans-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text, #0f172a);
  margin: 0 0 12px 0;
}
.slide h3 {
  font-family: var(--font-title, 'Inter', system-ui, sans-serif);
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text, #0f172a);
}
.slide p {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: var(--text-light, #1f2937);
  line-height: 1.5;
}

/* ================================================================
   LAYOUT: BASIC (single column text, items, summary, big_number)
   ================================================================ */
.layout-basic .slide-body {
  flex: 1;
  overflow: hidden;
}
.layout-basic--accent-left {
  border-left: 6px solid var(--accent, #f0b000);
  padding-left: 50px !important;
}
.layout-basic--boxed .slide-body {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(128,128,128,0.12);
  border-radius: var(--radius, 16px);
  padding: 20px;
}

/* --- Items list --- */
.slide .items-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.slide .item {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: start;
}
.slide .item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--primary, #2166ac);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.slide .item-text {
  font-size: 0.95rem;
  color: var(--text-light, #1f2937);
  line-height: 1.5;
}

/* --- Big number (single metric) --- */
.slide .big-number {
  flex: 1;
  display: grid;
  place-items: center;
  text-align: center;
}
.slide .big-number .stat-value {
  font-size: 4rem;
  font-weight: 800;
  color: var(--primary, #2166ac);
  line-height: 1.1;
}
.slide .big-number .stat-label {
  font-size: 1.2rem;
  color: var(--text-muted, #6b7280);
  margin-top: 12px;
}

/* ================================================================
   LAYOUT: TWO-COL (comparison, split_comparison)
   ================================================================ */
.layout-two-col .slide-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  align-items: start;
}
.layout-two-col .col {
  overflow: hidden;
}
.layout-two-col--reverse .col:first-child { grid-column: 2; }
.layout-two-col--reverse .col:last-child  { grid-column: 1; grid-row: 1; }
.layout-two-col--accent-left .slide-body {
  border-left: 6px solid var(--accent, #f0b000);
  padding-left: 24px;
}

/* ================================================================
   LAYOUT: TEXT + CHART
   ================================================================ */
.layout-text-chart .slide-body {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 32px;
  align-items: center;
}
.layout-text-chart--reverse .slide-body {
  grid-template-columns: 1.2fr 1fr;
}
.layout-text-chart--accent .slide-body [data-chart-id] {
  border-radius: var(--radius, 16px);
  background: rgba(128,128,128,0.04);
  padding: 16px;
}

/* ================================================================
   LAYOUT: FULL CHART
   ================================================================ */
.layout-full-chart .slide-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.layout-full-chart .chart-slot,
.layout-full-chart [data-chart-id] {
  flex: 1;
  min-height: 340px;
}

/* ================================================================
   LAYOUT: CARDS (three_column_cards, big_number_stats)
   ================================================================ */
.layout-cards-3 .slide-body {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: stretch;
}
.slide .card {
  padding: 24px;
  border-radius: var(--radius, 16px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(128,128,128,0.12);
  box-shadow: var(--shadow-card, 0 4px 24px rgba(0,0,0,0.08));
  overflow: hidden;
}
.slide .card h3 {
  margin: 0 0 10px 0;
  font-size: 1.05rem;
}
.layout-cards-3--accent-top .card {
  border-top: 4px solid var(--accent, #f0b000);
}
.layout-cards-3--shadow .card {
  box-shadow: 0 14px 36px rgba(0,0,0,0.14);
}

/* --- Stats grid (big_number_stats) --- */
.slide .stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  align-items: stretch;
}
.slide .stat {
  text-align: center;
  padding: 24px 16px;
  border-radius: var(--radius, 16px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(128,128,128,0.12);
}
.slide .stat .stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary, #2166ac);
  line-height: 1.1;
}
.slide .stat .stat-label {
  font-size: 0.9rem;
  color: var(--text-muted, #6b7280);
  margin-top: 8px;
}

/* ================================================================
   LAYOUT: STEPS (steps, pyramid, funnel)
   ================================================================ */
.layout-steps .slide-body {
  display: flex;
  gap: 16px;
}
.layout-steps--vertical .slide-body {
  flex-direction: column;
}
.slide .step {
  flex: 1;
  padding: 20px;
  border-radius: var(--radius, 16px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(128,128,128,0.12);
  overflow: hidden;
}
.slide .step-number {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--primary, #2166ac);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.slide .step-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 6px;
}
.slide .step-text {
  font-size: 0.85rem;
  color: var(--text-light, #1f2937);
  line-height: 1.4;
}

/* --- Pyramid / Funnel --- */
.slide .pyramid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.slide .layer {
  width: var(--layer-width, 100%);
  max-width: 100%;
  padding: 14px 20px;
  border-radius: 8px;
  background: var(--primary, #2166ac);
  color: #fff;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 500;
  transition: width 0.3s;
}
.slide .layer:nth-child(2) { opacity: 0.85; }
.slide .layer:nth-child(3) { opacity: 0.7; }
.slide .layer:nth-child(4) { opacity: 0.55; }
.slide .layer:nth-child(5) { opacity: 0.4; }

/* ================================================================
   LAYOUT: TIMELINE
   ================================================================ */
.layout-timeline .slide-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
}
.slide .timeline-item {
  padding: 18px;
  border-radius: var(--radius, 16px);
  border: 1px solid rgba(128,128,128,0.12);
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.slide .timeline-item .time {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--primary, #2166ac);
  margin-bottom: 8px;
}
.slide .timeline-item .event {
  font-size: 0.85rem;
  color: var(--text-light, #1f2937);
  line-height: 1.4;
}
.layout-timeline--center .timeline-item {
  text-align: center;
}

/* ================================================================
   LAYOUT: TABLE
   ================================================================ */
.layout-table .slide-body {
  overflow: auto;
}
.slide .data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.slide .data-table th {
  text-align: left;
  padding: 10px 14px;
  background: var(--primary, #2166ac);
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
}
.slide .data-table td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(128,128,128,0.12);
  color: var(--text-light, #1f2937);
}
.slide .data-table tr:nth-child(even) td {
  background: rgba(128,128,128,0.04);
}

/* ================================================================
   LAYOUT: CONCENTRIC CIRCLES (TAM/SAM/SOM)
   ================================================================ */
.layout-concentric .slide-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  align-items: center;
}
.layout-concentric--stack .slide-body {
  grid-template-columns: 1fr;
  justify-items: center;
}
.slide .circles {
  display: grid;
  place-items: center;
  width: 320px;
  height: 320px;
  margin: 0 auto;
}
.slide .circle {
  border-radius: 999px;
  border: 3px solid var(--primary, #2166ac);
  display: grid;
  place-items: center;
  text-align: center;
  padding: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}
.slide .circle-outer  { width: 300px; height: 300px; background: rgba(33,102,172,0.08); }
.slide .circle-middle { width: 210px; height: 210px; background: rgba(33,102,172,0.15); }
.slide .circle-inner  { width: 120px; height: 120px; background: rgba(33,102,172,0.25); }
.slide .legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.slide .legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--text-light, #1f2937);
}
.slide .legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary, #2166ac);
  flex-shrink: 0;
}

/* ================================================================
   LAYOUT: COVER / THANKS
   ================================================================ */
.layout-cover {
  display: grid !important;
  place-items: center;
  text-align: center;
}
.layout-cover .title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.layout-cover .title-block .title,
.layout-cover .title {
  font-size: 2.6rem;
  font-weight: 800;
}
.layout-cover .title-block .subtitle,
.layout-cover .subtitle {
  font-size: 1.1rem;
  color: var(--text-muted, #6b7280);
}

/* ================================================================
   LAYOUT: QUOTE
   ================================================================ */
.layout-quote {
  display: grid !important;
  place-items: center;
  text-align: center;
}
.slide .quote-block {
  max-width: 900px;
  padding: 0 40px;
}
.slide .quote {
  font-size: 1.8rem;
  font-style: italic;
  color: var(--text, #0f172a);
  line-height: 1.4;
}
.slide .quote-attrib {
  margin-top: 20px;
  font-size: 1rem;
  color: var(--text-muted, #6b7280);
  font-style: normal;
}

/* ================================================================
   LAYOUT: SWOT (mapped to layout-cards-3 but 2x2 grid)
   ================================================================ */
.slide .swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  flex: 1;
}
.slide .swot-grid .card {
  padding: 16px;
}
.slide .swot-grid .card h3 {
  font-size: 0.95rem;
  margin-bottom: 8px;
}

/* ================================================================
   CHART SLOT (universal)
   ================================================================ */
.slide .chart-slot,
.slide [data-chart-id] {
  width: 100%;
  height: 320px;
  min-height: 260px;
  max-height: 420px;
  overflow: hidden;
  display: block;
  position: relative;
}
.slide .chart-slot canvas,
.slide [data-chart-id] canvas {
  width: 100% !important;
  height: 100% !important;
}
"""


def _build_positioning_context(
    element_positions: Any,
    spacing: Any,
    visual_hierarchy: Any,
) -> str:
    """Format layout agent positioning decisions into guidance for the HTML writer."""
    parts: List[str] = []
    if isinstance(visual_hierarchy, dict):
        primary = visual_hierarchy.get("primary_focus", "")
        secondary = visual_hierarchy.get("secondary_focus", "")
        if primary:
            parts.append(f"Primary visual focus: {primary} (give this the most prominent space)")
        if secondary:
            parts.append(f"Secondary focus: {secondary}")
    if isinstance(spacing, dict):
        lw = spacing.get("left_column_width")
        rw = spacing.get("right_column_width")
        if lw and rw:
            try:
                left_pct = int(float(lw) * 100)
                right_pct = int(float(rw) * 100)
                parts.append(f"Column proportions: left {left_pct}%, right {right_pct}%")
            except (TypeError, ValueError):
                pass
    if isinstance(element_positions, dict):
        for elem, pos in element_positions.items():
            if isinstance(pos, dict) and "w" in pos and "h" in pos:
                parts.append(
                    f"  {elem}: width ~{pos['w']}in, height ~{pos['h']}in"
                )
    return "\n".join(parts) if parts else ""


async def _render_slide_html_agentic_document(
    llm_client: Any,
    slide_index: int,
    layout_type: str,
    title: str,
    subtitle: str,
    content: List[str],
    chart_id: str | None,
    chart_spec: Dict[str, Any] | None,
    theme: Dict[str, Any],
    qa_feedback: str | None = None,
    max_retries: int = 2,
    structured: Dict[str, Any] | None = None,
    element_positions: Dict[str, Any] | None = None,
    spacing: Dict[str, Any] | None = None,
    visual_hierarchy: Dict[str, Any] | None = None,
    variety_hint: str | None = None,
) -> str:
    """
    Per-slide agentic mode: LLM outputs a complete HTML document for a slide.
    CSS must be scoped to #slide-{n} for safe combination.
    """
    slide_id = f"slide-{slide_index}"
    layout_key = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(layout_type).strip())
    layout_key = layout_key.strip("-") or "basic"
    layout_class = f"layout-{layout_key}"

    chart_context = ""
    if chart_id and chart_spec:
        chart_context = _format_chart_context(chart_spec, chart_id=chart_id)
    elif chart_id:
        chart_context = (
            f'Include a chart placeholder: <div class="chart-slot" data-chart-id="{chart_id}"></div>'
        )

    chart_instruction = (
        f'- If chart_id is provided, include <div class="chart-slot" data-chart-id="{chart_id}"></div> and leave it empty (no placeholder text).'
        if chart_id
        else "- Do NOT include any chart placeholder (.chart-slot or data-chart-id) on this slide."
    )

    creative_hints: List[str] = []
    if variety_hint:
        creative_hints.append(f"VARIETY HINT: {variety_hint}")
    layout_key_hint = str(layout_type).lower()
    if "timeline" in layout_key_hint:
        creative_hints.append(
            "Timeline options: horizontal line with nodes, vertical flow, stepped roadmap, curved path, or branching timeline."
        )
    elif "comparison" in layout_key_hint:
        creative_hints.append(
            "Comparison options: side-by-side cards, split panels, table layout, versus diagram, or overlapping panels."
        )
    elif "steps" in layout_key_hint or "process" in layout_key_hint:
        creative_hints.append(
            "Steps options: horizontal cards with connectors, vertical stack with numbered badges, or circular process."
        )
    elif "chart" in layout_key_hint:
        creative_hints.append(
            "Chart options: chart-dominant layout with insight callouts, split text+chart, or chart with KPI strip."
        )
    elif "cards" in layout_key_hint or "items" in layout_key_hint:
        creative_hints.append(
            "Cards/items options: 2-column grid, 3-column grid, staggered cards, bento-style layout, or ribbon list."
        )

    creative_section = ""
    if creative_hints:
        creative_section = "\n=== CREATIVE OPTIONS ===\n- " + "\n- ".join(creative_hints) + "\n"

    system_prompt = f"""You are an elite presentation designer and frontend engineer.
Create a UNIQUE, CREATIVE HTML layout for this slide while following core engineering principles.

=== ENGINEERING PRINCIPLES (MANDATORY) ===

PRINCIPLE 1: ANTI-OVERLAP ARCHITECTURE
Problem to solve: Elements must not overlap or exceed slide boundaries.

Your solution MUST:
- Use flexbox or grid (NEVER absolute positioning for main content)
- Slide container: display:flex; flex-direction:column
- Allocate explicit space: title area + content area = 1080px total
- Use overflow:hidden on containers to prevent spillover

Example approaches (choose one or invent your own):
a) Title: flex:0 0 100px; Content: flex:1
b) Title: max-height:120px; Content: height:calc(100% - 120px)
c) Grid: grid-template-rows: auto 1fr

PRINCIPLE 2: HEIGHT BUDGETING
Problem to solve: Content must fit 1080px height.

Your solution MUST:
- Calculate available space: 1080px - title - padding = content space
- If multiple sections: allocate percentages (e.g., 50% chart, 50% text)
- Set max-height on all major containers
- Use flex-shrink:0 on fixed-height elements

PRINCIPLE 3: RESPONSIVE SPACING
Problem to solve: Elements need breathing room.

Your solution MUST:
- Minimum padding: 40px from slide edges
- Gaps between elements: 16-32px (your choice based on design)
- Use CSS gap property or margins (be consistent)

PRINCIPLE 4: READABILITY
Problem to solve: Text must be legible.

Your solution MUST:
- Font size >= 11px for body text
- High contrast (light text on dark OR dark text on light)
- No text on complex backgrounds unless you add overlay/shadow

=== CREATIVE FREEDOM (ENCOURAGED) ===

You have COMPLETE freedom to be creative with:

LAYOUTS:
- Grid (2-column, 3-column, asymmetric, bento-box, masonry)
- Flow (horizontal, vertical, diagonal, circular, spiral)
- Hybrid (mix grid + flow, split-screen, sidebar + main)
- Experimental (hexagon grid, card stack, magazine layout)

VISUAL STYLE:
- Color palette (choose any professional scheme)
- Card style (rounded, sharp, borderless, floating, nested)
- Decorative elements (gradients, shapes, patterns, glows)
- Typography (bold, elegant, modern, classic - your choice)
- Icons (solid, outline, gradient, duotone, illustrated)

COMPOSITION:
- Symmetric or asymmetric
- Centered or off-center
- Minimalist or rich
- Playful or serious

REQUIREMENT: Make each slide VISUALLY DISTINCT from previous slides.

=== DIVERSITY GUIDELINES ===

To ensure variety across the deck:
- Don't default to 2-column grid every time
- Vary your layout approach based on content
- Try different visual metaphors (timeline, comparison, hierarchy, etc.)
- Experiment with spacing, sizing, positioning
- Use different decorative elements

Think: "What layout would make THIS content most engaging?"
{creative_section}

=== FORBIDDEN ANTI-PATTERNS ===

NEVER do these (they cause the bugs you're trying to avoid):

❌ position:absolute on title, text, or main content areas
❌ Hardcoded pixel heights without max-height constraints
❌ Overlapping containers (check z-index if layering)
❌ Text directly on graphics (use separate containers)
❌ Content exceeding 1080px total height
❌ Tiny fonts (<11px)
❌ Low contrast text

=== OUTPUT REQUIREMENTS ===

Generate complete HTML document:
- <!doctype html>, <html>, <head>, <body>
- Single <style> block in <head>
- You MAY define layout CSS in the per-slide <style> to implement the layout.
- Use the layout class "{layout_class}" for layout.
- All CSS scoped to #{slide_id} if you add any overrides.
- Single <section id="{slide_id}" class="slide {layout_class}"> in body
- No <script> tags
{chart_instruction}
- Slide container must be exactly 1920x1080 (16:9).

Be creative. Be bold. Be professional.
"""

    # Build contextual sections for the user prompt
    qa_section = ""
    if qa_feedback:
        qa_section = f"\nVISUAL QA FEEDBACK (fix these issues):\n{qa_feedback}\n"

    structured_section = ""
    struct_ctx = _build_structured_context(structured or {})
    if struct_ctx:
        structured_section = f"\nSTRUCTURED CONTENT:\n{struct_ctx}\n"

    positioning_section = ""
    pos_ctx = _build_positioning_context(
        element_positions or {}, spacing or {}, visual_hierarchy or {}
    )
    if pos_ctx:
        positioning_section = f"\nLAYOUT POSITIONING:\n{pos_ctx}\n"

    variety_section = ""
    if variety_hint:
        variety_section = f"\nVARIETY: {variety_hint}\n"

    user_prompt_base = f"""Generate a complete single-slide HTML document.

SLIDE ID: {slide_id}
LAYOUT TYPE: {layout_type}
LAYOUT CLASS (use this class on the <section>): {layout_class}
TITLE: {title}
SUBTITLE: {subtitle}
CONTENT: {json.dumps(content, ensure_ascii=False)}

THEME:
{json.dumps(theme, ensure_ascii=False)}

CHART:
{chart_context}
{structured_section}{positioning_section}{variety_section}{qa_section}
OUTPUT: A single complete HTML document as plain text.
"""

    env_retries = os.getenv("HTML_AGENTIC_SLIDE_RETRIES")
    if env_retries is not None:
        try:
            max_retries = max(0, min(int(str(env_retries).strip()), 5))
        except (TypeError, ValueError):
            pass

    best_html = ""
    best_issue_count = 10**9
    last_error = None
    retry_feedback = ""

    def _parse_temp(value: str | None, default: float) -> float:
        if value is None:
            return default
        try:
            parsed = float(str(value).strip())
        except (TypeError, ValueError):
            return default
        return max(0.0, min(parsed, 1.0))

    base_temp = _parse_temp(os.getenv("HTML_AGENTIC_TEMPERATURE"), 0.5)
    retry_temp = _parse_temp(os.getenv("HTML_AGENTIC_TEMPERATURE_RETRY"), 0.2)

    for attempt in range(max_retries + 1):
        try:
            user_prompt = user_prompt_base
            if retry_feedback:
                user_prompt = f"""{user_prompt_base}

ISSUES FROM PREVIOUS OUTPUT (fix these):
{retry_feedback}

Regenerate the HTML and fix every issue listed above.
"""
            result = await llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=base_temp if attempt == 0 else retry_temp,
                max_tokens=3000,
                response_format="text",
            )
            if isinstance(result, dict):
                html = result.get("response") or result.get("text") or ""
            else:
                html = str(result)
            if html:
                html = _normalize_slide_document(html, slide_id, layout_class)
                html_lower = html.lower()
                if f'id="{slide_id}' in html_lower or f"id='{slide_id}" in html_lower:
                    html = _strip_section_inline_style(html, slide_id)
                    html = _strip_inline_size_styles(html)
                    html = _enforce_section_class(html, slide_id, f"slide {layout_class}")
                    html = _inject_required_structure(html, slide_id, layout_type, chart_id, content)
                    html = _inject_slide_safety_css(html, slide_id)
                    issues = _evaluate_slide_document(html, slide_id, chart_id, layout_type)
                    if len(issues) < best_issue_count:
                        best_html = html
                        best_issue_count = len(issues)
                    if not issues:
                        return html
                    if _missing_required_structure(issues) and attempt >= max_retries:
                        return _build_fallback_slide_html(
                            slide_id=slide_id,
                            layout_class=layout_class,
                            title=title,
                            subtitle=subtitle,
                            content=content,
                            chart_id=chart_id,
                            layout_type=layout_type,
                        )
                    retry_feedback = "\n".join(f"- {issue}" for issue in issues)
                    print(
                        f"⚠️ Slide {slide_index} attempt {attempt + 1} had {len(issues)} issue(s): "
                        f"{'; '.join(issues)}"
                    )
                else:
                    best_html = html
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        print(f"  Per-slide generation failed (slide {slide_index}): {last_error}")
    return best_html or ""


# ---------------------------------------------------------------------------
# Slide combination
# ---------------------------------------------------------------------------


def _combine_slide_documents(
    topic: str,
    slide_docs: List[str],
    charts: List[Dict[str, Any]],
    theme: Dict[str, Any],
) -> str:
    styles = []
    bodies = []
    for doc in slide_docs:
        if not doc:
            continue
        style_blocks = re.findall(r"<style[^>]*>(.*?)</style>", doc, flags=re.IGNORECASE | re.DOTALL)
        styles.extend(style_blocks)
        body_match = re.search(r"<body[^>]*>(.*?)</body>", doc, flags=re.IGNORECASE | re.DOTALL)
        body = body_match.group(1) if body_match else doc
        body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.IGNORECASE | re.DOTALL)
        bodies.append(body.strip())

    font_title = theme.get("fonts", {}).get("title", "Inter")
    font_body = theme.get("fonts", {}).get("body", "Inter")
    base_css = f"""
    body {{
      margin: 0;
      background: #f5f6f8;
      font-family: '{font_body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }}
    .deck {{
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 32px 24px 80px;
    }}
    .deck-title {{
      font-family: '{font_title}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 24px;
      color: #0f172a;
    }}
    /* Normalize slide size across per-slide agentic CSS */
    .slide {{
      width: 1920px !important;
      height: 1080px !important;
      min-width: 1920px !important;
      min-height: 1080px !important;
      flex: 0 0 1080px !important;
      overflow: hidden !important;
      position: relative;
      box-sizing: border-box;
    }}
    .slide, .slide *, .slide *::before, .slide *::after {{
      box-sizing: border-box;
    }}
    .slide h1, .slide h2, .slide h3, .slide h4, .slide h5, .slide h6,
    .slide p, .slide li, .slide td, .slide th, .slide span {{
      overflow-wrap: anywhere;
      word-break: break-word;
    }}
    .slide img, .slide svg, .slide canvas, .slide table {{
      max-width: 100% !important;
    }}
    .slide .chart-slot, .slide [data-chart-id] {{
      width: 100%;
      height: 320px;
      min-height: 260px;
      max-height: 420px;
      overflow: hidden;
      display: block;
      position: relative;
    }}
    .slide .chart-slot canvas, .slide [data-chart-id] canvas {{
      width: 100% !important;
      height: 100% !important;
    }}

    @media print {{
      @page {{
        size: 1920px 1080px;
        margin: 0;
      }}
      html, body {{
        margin: 0 !important;
        padding: 0 !important;
        width: 1920px !important;
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
      }}
      .deck {{
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        gap: 0 !important;
        align-items: initial !important;
        justify-content: initial !important;
      }}
      .deck-title {{
        display: none !important;
      }}
      section.slide,
      .slide {{
        /* Keep internal flex/grid layout intact — only control page flow */
        position: relative !important;
        left: auto !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        transform: none !important;
        width: 1920px !important;
        height: 1080px !important;
        min-width: 1920px !important;
        min-height: 1080px !important;
        max-width: 1920px !important;
        max-height: 1080px !important;
        overflow: hidden !important;
        margin: 0 !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-sizing: border-box !important;
        border-radius: 0 !important;
      }}
      section.slide:last-of-type,
      .slide:last-of-type {{
        page-break-after: auto !important;
        break-after: auto !important;
      }}
    }}
    """

    combined_styles = "\n\n".join(styles)
    slides_html = "\n\n".join(bodies)

    safe_title = _safe_html_title(topic or "Deck")
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{_escape_html(safe_title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
{base_css}
{combined_styles}
  </style>
</head>
<body>
  <div class="deck">
    {slides_html}
  </div>
  <script>
    const charts = {json.dumps(charts)};
    charts.forEach(cfg => {{
      let canvas = document.getElementById(cfg.id);
      if (!canvas) {{
        const slot = document.querySelector(`[data-chart-id="${{cfg.id}}"]`);
        if (slot) {{
          slot.innerHTML = '';
          canvas = document.createElement('canvas');
          canvas.id = cfg.id;
          slot.appendChild(canvas);
        }}
      }}
      if (!canvas) return;
      new Chart(canvas, cfg.config);
    }});
  </script>
</body>
</html>
"""
    return html


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------


def _escape_html(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _safe_html_title(text: str, max_len: int = 120) -> str:
    """Create a short, single-line <title> from a verbose prompt."""
    if not text:
        return "Deck"
    first_line = str(text).splitlines()[0].strip()
    cleaned = re.sub(r"\s+", " ", first_line).strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[: max_len - 1].rstrip() + "\u2026"
    return cleaned or "Deck"
