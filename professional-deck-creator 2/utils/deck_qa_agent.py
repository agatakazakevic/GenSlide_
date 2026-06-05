"""
Deck-level QA agent.
Reviews full deck with layouts and proposes structured fixes.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List


class DeckQAAgent:
    def __init__(self, llm_client):
        self.llm_client = llm_client

    async def review(
        self,
        slides: List[Dict[str, Any]],
        layouts: List[Dict[str, Any]],
        guidelines: str | None = None,
        lock_layouts: bool = True
    ) -> Dict[str, Any]:
        payload = self._build_payload(slides, layouts, guidelines)
        try:
            response = await self.llm_client.generate(
                system_prompt=self._system_prompt(lock_layouts),
                user_prompt=payload,
                temperature=0.2,
                response_format="json"
            )
            if isinstance(response, dict) and "fixes" in response:
                return response
        except Exception:
            pass
        return {"fixes": [], "notes": "qa_skipped"}

    def _build_payload(
        self,
        slides: List[Dict[str, Any]],
        layouts: List[Dict[str, Any]],
        guidelines: str | None
    ) -> str:
        simplified = []
        for slide, layout in zip(slides, layouts):
            simplified.append({
                "slide_number": slide.get("slide_number"),
                "title": slide.get("title", ""),
                "content_type": slide.get("content_type", ""),
                "content": slide.get("content", []),
                "has_chart": "chart" in slide,
                "layout_type": layout.get("layout_type", "")
            })
        guide_block = f"\nGUIDELINES:\n{guidelines}\n" if guidelines else ""
        return f"Review this deck and propose fixes:\n{json.dumps(simplified, indent=2)}{guide_block}"

    def _system_prompt(self, lock_layouts: bool) -> str:
        layout_rule = (
            "Layouts are LOCKED. Do NOT use set_layout or title_only actions."
            if lock_layouts else
            "Layouts are UNLOCKED. You may use set_layout(value) and title_only actions."
        )

        allowed = "shorten_title, shorten_bullets, add_chart"
        if not lock_layouts:
            allowed = "set_layout(value), shorten_title, shorten_bullets, title_only, add_chart"

        return f"""You are a strict IR deck QA reviewer. Review the full deck and propose fixes.

REVIEW CHECKLIST:
1. TITLES: Must be under 45 characters. If longer, propose shorten_title.
2. BULLET DENSITY: Max 5 bullets per slide. If more, propose shorten_bullets.
3. DUPLICATE CONTENT: Flag slides that repeat the same point as another slide.
4. MISSING COVERAGE: Check the deck covers: Market, Solution, Team, Financials, Risk.
5. NARRATIVE FLOW: Slides should progress logically (problem, solution, proof, ask).
6. CHART OPPORTUNITIES: If a slide has numeric claims but no chart, propose add_chart.
7. NEVER add charts to title or thanks slides.

CONSTRAINTS:
- {layout_rule}
- Allowed actions: {allowed}

OUTPUT FORMAT (valid JSON):
{{
  "fixes": [
    {{"slide_number": 2, "actions": [{{"type": "shorten_title"}}], "reason": "Title is 62 chars, exceeds 45 limit"}}
  ],
  "coverage_gaps": ["No team/founders slide found"],
  "notes": "Overall assessment"
}}"""
