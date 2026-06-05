"""
Visual QA utilities for HTML decks.

- Render slides to PNG using Playwright (if available).
- Run Gemini Vision critique per slide in parallel.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


async def render_html_slides_to_images(
    html_path: str,
    output_dir: str | None = None,
    viewport: tuple[int, int] = (2200, 1400),
    wait_ms: int = 800,
) -> List[str]:
    """
    Render each <section class="slide"> to a PNG image.
    Requires Playwright + Chromium. If unavailable, returns [].
    """
    try:
        from playwright.async_api import async_playwright
    except Exception as exc:
        print(f"⚠️  Playwright not available; skipping visual QA screenshots: {exc}")
        return []

    path = Path(html_path).expanduser().resolve()
    if not path.exists():
        print(f"⚠️  HTML not found for visual QA: {html_path}")
        return []

    env_output = os.getenv("VISUAL_QA_OUTPUT_DIR")
    if env_output:
        output_dir = env_output
    if not output_dir:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(tempfile.gettempdir(), "slide_reviews", ts)
    os.makedirs(output_dir, exist_ok=True)
    print(f"🔍 Visual QA screenshots will be saved to: {output_dir}")

    uri = path.as_uri()
    images: List[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
        await page.goto(uri, wait_until="domcontentloaded")
        try:
            await page.wait_for_selector("section.slide", timeout=5000)
        except Exception as exc:
            print(f"⚠️  Visual QA could not find any slides: {exc}")
        # Force a neutral background + remove transforms that can break screenshots
        try:
            await page.add_style_tag(content="""
                body { background: #ffffff !important; }
                section.slide {
                  transform: none !important;
                  width: 1920px !important;
                  height: 1080px !important;
                  max-width: 1920px !important;
                  max-height: 1080px !important;
                  min-width: 1920px !important;
                  min-height: 1080px !important;
                }
            """)
        except Exception:
            pass
        await page.wait_for_timeout(wait_ms)

        slides = await page.query_selector_all("section.slide")
        print(f"🔍 Visual QA found {len(slides)} slide(s)")
        for idx, slide in enumerate(slides, start=1):
            try:
                await slide.scroll_into_view_if_needed()
            except Exception:
                pass
            img_path = os.path.join(output_dir, f"slide_{idx:02d}.png")
            try:
                box = await slide.bounding_box()
                if not box or box.get("width", 0) < 10 or box.get("height", 0) < 10:
                    print(f"⚠️  Slide {idx} has invalid bounds: {box}")
                else:
                    print(f"🔍 Slide {idx} bounds: {box}")
                await slide.screenshot(path=img_path)
                images.append(img_path)
            except Exception as exc:
                print(f"⚠️  Failed to screenshot slide {idx}: {exc}")

        if os.getenv("VISUAL_QA_DEBUG_FULLPAGE", "").lower() in {"1", "true", "yes"}:
            try:
                full_path = os.path.join(output_dir, "deck_full.png")
                await page.screenshot(path=full_path, full_page=True)
                print(f"🔍 Full-page QA screenshot saved: {full_path}")
            except Exception as exc:
                print(f"⚠️  Failed full-page screenshot: {exc}")

        await browser.close()

    return images


def _extract_json_block(text: str) -> Dict[str, Any] | None:
    if not text:
        return None
    text = text.strip()
    # Strip fenced code blocks if present (even if missing closing fence)
    if "```" in text:
        text = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE)
        text = text.replace("```", "")
        text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            return json.loads(text)
        except Exception:
            pass
    def _has_unclosed_string(s: str) -> bool:
        in_string = False
        escaped = False
        for ch in s:
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if ch == '"':
                in_string = not in_string
        return in_string

    def _auto_repair(s: str) -> str:
        s = s.strip()
        start = s.find("{")
        if start != -1:
            s = s[start:]
        # Balance quotes first
        if _has_unclosed_string(s):
            s += '"'
        # Balance brackets then braces
        open_brackets = s.count("[")
        close_brackets = s.count("]")
        if open_brackets > close_brackets:
            s += "]" * (open_brackets - close_brackets)
        open_braces = s.count("{")
        close_braces = s.count("}")
        if open_braces > close_braces:
            s += "}" * (open_braces - close_braces)
        return s

    # Try to find JSON block inside text
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    # Attempt to auto-close truncated JSON
    if text.startswith("{"):
        repaired = _auto_repair(text)
        try:
            return json.loads(repaired)
        except Exception:
            pass
    # Fallback: slice from first { to last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            return None
    # Last resort: auto-repair whatever we have
    repaired = _auto_repair(text)
    try:
        return json.loads(repaired)
    except Exception:
        return None
    return None


def _extract_issues_from_text(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []
    issues: List[Dict[str, Any]] = []
    # Find all "type" occurrences as anchors
    for match in re.finditer(r'"type"\s*:\s*"([^"]+)"', text):
        start = match.start()
        segment = text[start:start + 400]  # small window after type
        issue_type = match.group(1).strip()
        severity_match = re.search(r'"severity"\s*:\s*"([^"]+)"', segment)
        detail_match = re.search(r'"detail"\s*:\s*"([^"]+)"', segment)
        # Handle truncated detail without closing quote
        if not detail_match:
            detail_match = re.search(r'"detail"\s*:\s*"([^"\n\r]+)', segment)
        issues.append({
            "type": issue_type or "other",
            "severity": (severity_match.group(1).strip() if severity_match else "medium"),
            "detail": (detail_match.group(1).strip() if detail_match else "Issue detected in QA output."),
        })
        if len(issues) >= 2:
            break
    return issues


def _repair_review_from_text(text: str, slide_index: int) -> Dict[str, Any] | None:
    if not text:
        return None
    slide_match = re.search(r'"slide"\s*:\s*(\d+)', text)
    slide_num = int(slide_match.group(1)) if slide_match else slide_index
    needs_match = re.search(r'"needs_revision"\s*:\s*(true|false)', text, flags=re.IGNORECASE)
    needs_revision = True
    if needs_match:
        needs_revision = needs_match.group(1).lower() == "true"

    issues = _extract_issues_from_text(text)
    if not issues:
        issues = [{
            "type": "other",
            "severity": "medium",
            "detail": "QA response missing issue details",
        }]
    summary = text.strip().replace("\n", " ")[:180]
    return {
        "slide": slide_num,
        "needs_revision": needs_revision or True,
        "issues": issues,
        "summary": summary,
    }


async def critique_slide_with_gemini(
    llm_client: Any,
    image_path: str,
    slide_index: int,
    slide_meta: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Use Gemini Vision to critique slide image for overlaps/clipping/layout issues.
    """
    if not llm_client:
        return {"slide": slide_index, "error": "LLM client not configured"}
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except Exception as exc:
        return {"slide": slide_index, "error": f"Failed to read image: {exc}"}

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    system_prompt = (
        "You are a visual QA reviewer for slide renders. "
        "Identify overlaps, clipping, misalignment, off-canvas content, or unreadable text. "
        "If a chart is present, verify category labels/axis labels are visible and the legend "
        "is present when multiple series exist. "
        "Return ONLY a single JSON object. "
        "No markdown, no code fences, no extra text."
    )
    slide_meta = slide_meta or {}
    meta = json.dumps(slide_meta, ensure_ascii=False)
    chart_meta = slide_meta.get("chart") or {}
    expected_labels = chart_meta.get("labels") or []
    expected_series = chart_meta.get("series_name") or ""
    deck_type = str(slide_meta.get("deck_type") or "general").lower()
    user_prompt = f"""
Slide index: {slide_index}
Slide metadata (optional): {meta}
Expected chart labels (if chart present): {expected_labels}
Expected chart series/legend label (if chart present): {expected_series}

Return JSON with this schema (no markdown, no code fences).
Keep it SHORT:
- issues: max 2 items
- issue.detail: max 120 characters
- summary: max 160 characters
{{
  "slide": {slide_index},
  "needs_revision": true|false,
  "issues": [
    {{"type": "overlap|clipping|alignment|readability|chart_labels_missing|chart_legend_missing|tam_sam_som_order|missing_sources|other",
      "severity": "low|medium|high",
      "detail": "..." }}
  ],
  "summary": "short summary"
}}

If you are unsure, still return valid JSON with needs_revision=true and a single issue.
"""
    if deck_type == "ir":
        user_prompt += """

IR-specific checks:
- If chart present, verify axis/category labels and legend/series label are visible.
- If TAM/SAM/SOM or market sizing is shown, ensure order is descending and labels visible.
- If numeric claims are visible without any source/footnote on the slide, flag missing_sources.
"""

    free_text_mode = os.getenv("VISUAL_QA_FREE_TEXT", "").lower() in {"1", "true", "yes"}
    max_raw = int(os.getenv("VISUAL_QA_FREE_TEXT_MAX_CHARS", "1200"))

    try:
        result = await llm_client.generate_with_image(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_data=image_b64,
            mime_type="image/png",
            model_preference="gemini",
            temperature=0.2,
            max_tokens=300,
            response_format="text",
        )
        response = result.get("response", "") if isinstance(result, dict) else ""
    except Exception as exc:
        return {"slide": slide_index, "error": f"Gemini Vision error: {exc}"}

    if free_text_mode:
        return {
            "slide": slide_index,
            "needs_revision": True,
            "raw": response[:max_raw],
        }

    parsed = _extract_json_block(response)
    if parsed:
        # Ensure issues list exists and is valid
        if not isinstance(parsed, dict):
            parsed = {}
        issues = parsed.get("issues")
        if not isinstance(issues, list) or not issues:
            parsed["issues"] = [{
                "type": "other",
                "severity": "medium",
                "detail": "QA response missing issue details",
            }]
        parsed.setdefault("slide", slide_index)
        parsed.setdefault("needs_revision", True)
        parsed.setdefault("summary", response[:180])
        return parsed
    repaired = _repair_review_from_text(response, slide_index)
    if repaired:
        return repaired
    return {
        "slide": slide_index,
        "needs_revision": True,
        "issues": [{"type": "qa_parse_error", "severity": "medium", "detail": "Unparseable response"}],
        "summary": response[:300],
    }


def _deterministic_chart_issues(slide_meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect obvious chart issues without vision."""
    issues: List[Dict[str, Any]] = []
    chart = slide_meta.get("chart") or {}
    chart_type = str(chart.get("chart_type") or "").lower()
    labels = chart.get("labels") or []
    data_points = chart.get("data_points")
    data = chart.get("data") or []
    title = str(slide_meta.get("title") or "").lower()

    if chart_type in {"bar", "column", "line", "area"}:
        if not labels:
            issues.append({
                "type": "chart_labels_missing",
                "severity": "high",
                "detail": "Chart has no category labels.",
            })
        elif isinstance(data_points, int) and data_points != len(labels):
            issues.append({
                "type": "chart_labels_missing",
                "severity": "medium",
                "detail": "Chart labels count does not match data points.",
            })
    # TAM/SAM/SOM ordering check (deterministic)
    lower_labels = [str(l).lower() for l in labels]
    if any("tam" in l for l in lower_labels) and any("sam" in l for l in lower_labels):
        if len(data) >= 3:
            try:
                values = [float(v) for v in data[:3]]
                if not (values[0] >= values[1] >= values[2]):
                    issues.append({
                        "type": "tam_sam_som_order",
                        "severity": "high",
                        "detail": "TAM/SAM/SOM values not in descending order.",
                    })
            except Exception:
                pass
        if "market" in title and not labels:
            issues.append({
                "type": "chart_labels_missing",
                "severity": "medium",
                "detail": "Market sizing chart lacks labels.",
            })
    return issues


def _normalize_fix_targets(targets: Any) -> List[str]:
    if isinstance(targets, str):
        parts = [t.strip().lower() for t in re.split(r"[,\s]+", targets) if t.strip()]
        return list(dict.fromkeys(parts))
    if isinstance(targets, list):
        cleaned = []
        for item in targets:
            if not item:
                continue
            cleaned.append(str(item).strip().lower())
        return list(dict.fromkeys(cleaned))
    return []


def _fallback_route(review: Dict[str, Any]) -> Dict[str, Any]:
    targets: set[str] = set()
    issues = review.get("issues") or []
    for issue in issues if isinstance(issues, list) else []:
        if str(issue.get("type") or "").lower() == "qa_parse_error":
            targets.add("render")
            continue
        text = " ".join([
            str(issue.get("type") or ""),
            str(issue.get("detail") or ""),
        ]).lower()
        if any(k in text for k in ["chart", "legend", "axis", "bar", "line", "pie", "doughnut"]):
            targets.add("chart")
        if any(k in text for k in ["tam", "sam", "som", "market size", "market"]):
            targets.add("chart")
        if any(k in text for k in ["overlap", "clipping", "cut off", "overflow", "off-canvas"]):
            targets.update(["content", "layout"])
        if any(k in text for k in ["alignment", "misalign", "spacing", "position"]):
            targets.add("layout")
        if any(k in text for k in ["readability", "too small", "unreadable", "contrast"]):
            targets.add("content")
        if any(k in text for k in ["source", "citation", "footnote"]):
            targets.add("content")
    if not targets and review.get("needs_revision"):
        targets.add("render")
    return {
        "slide": int(review.get("slide", 0) or 0),
        "fix_targets": sorted(targets),
        "reason": "Fallback routing based on issue keywords.",
        "instructions": {},
    }


async def route_visual_qa_fixes(
    llm_client: Any,
    reviews: List[Dict[str, Any]],
    slide_meta: Dict[int, Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    """
    Decide which pipeline step(s) to rerun based on QA issues.
    Returns list of per-slide routing decisions.
    """
    if not llm_client:
        return [_fallback_route(r) for r in reviews if isinstance(r, dict)]

    slide_meta = slide_meta or {}
    system_prompt = (
        "You are a remediation router for slide visual QA. "
        "Decide the minimal set of pipeline steps to rerun. "
        "Return JSON only."
    )
    tasks = []

    async def _route_one(review: Dict[str, Any]) -> Dict[str, Any]:
        slide_num = int(review.get("slide", 0) or 0)
        meta = slide_meta.get(slide_num, {})
        user_prompt = f"""
Review:
{json.dumps(review, ensure_ascii=False)}

Slide meta:
{json.dumps(meta, ensure_ascii=False)}

Allowed fix_targets (choose minimal set):
- layout (layout choice/slots)
- content (text length/wording)
- chart (chart spec/data/labels)
- render (HTML/CSS post-fix)
- illustration (image slot)
- theme (colors/contrast)
- none

Return JSON:
{{
  "slide": {slide_num},
  "fix_targets": ["layout", "content"],
  "reason": "short reason",
  "instructions": {{
    "layout": "optional guidance",
    "content": "optional guidance",
    "chart": "optional guidance",
    "render": "optional guidance",
    "theme": "optional guidance"
  }}
}}
"""
        try:
            result = await llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=600,
                response_format="json",
            )
            parsed = result if isinstance(result, dict) else _extract_json_block(str(result))
            if not parsed:
                return _fallback_route(review)
            parsed["slide"] = slide_num
            parsed["fix_targets"] = _normalize_fix_targets(parsed.get("fix_targets"))
            if parsed.get("fix_targets") == ["none"]:
                parsed["fix_targets"] = []
            if review.get("needs_revision") and not parsed.get("fix_targets"):
                parsed["fix_targets"] = ["render"]
            return parsed
        except Exception:
            return _fallback_route(review)

    for review in reviews:
        if not isinstance(review, dict):
            continue
        tasks.append(_route_one(review))

    results = await asyncio.gather(*tasks, return_exceptions=False)
    return results


async def run_visual_qa(
    llm_client: Any,
    html_path: str,
    slides_meta: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    Render slides to images and critique in parallel with Gemini Vision.
    Returns a dict with image paths + review results.
    """
    images = await render_html_slides_to_images(html_path)
    if not images:
        return {"images": [], "reviews": [], "error": "no_images"}

    slides_meta = slides_meta or []
    tasks = []
    for idx, img_path in enumerate(images, start=1):
        meta = slides_meta[idx - 1] if idx - 1 < len(slides_meta) else None
        tasks.append(critique_slide_with_gemini(llm_client, img_path, idx, meta))

    reviews = await asyncio.gather(*tasks, return_exceptions=True)
    normalized = []
    for idx, result in enumerate(reviews, start=1):
        if isinstance(result, Exception):
            normalized.append({"slide": idx, "error": str(result)})
        else:
            normalized.append(result)

    # Add deterministic chart checks based on slide metadata
    for idx, review in enumerate(normalized, start=1):
        if not isinstance(review, dict):
            continue
        meta = slides_meta[idx - 1] if idx - 1 < len(slides_meta) else {}
        if isinstance(meta, dict) and meta.get("chart"):
            issues = review.get("issues") or []
            extra = _deterministic_chart_issues(meta)
            if extra:
                review["needs_revision"] = True
                if not isinstance(issues, list):
                    issues = []
                issues.extend(extra)
                review["issues"] = issues

        # IR-specific deterministic checks (missing sources for numeric claims)
        if isinstance(meta, dict) and str(meta.get("deck_type") or "").lower() == "ir":
            has_numbers = bool(meta.get("has_numbers"))
            has_footnotes = bool(meta.get("has_footnotes"))
            title = str(meta.get("title") or "").lower()
            if has_numbers and not has_footnotes and any(
                k in title for k in ["market", "tam", "sam", "som", "revenue", "arr", "cagr", "growth", "financial", "traction"]
            ):
                issues = review.get("issues") or []
                if not isinstance(issues, list):
                    issues = []
                issues.append({
                    "type": "missing_sources",
                    "severity": "medium",
                    "detail": "Numeric claims lack visible sources/footnotes.",
                })
                review["issues"] = issues
                review["needs_revision"] = True

    return {"images": images, "reviews": normalized}
