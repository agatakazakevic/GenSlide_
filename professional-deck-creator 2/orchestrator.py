"""
Advanced Deck Creation Orchestrator
Integrates:
1. Multi-agent content generation
2. AI layout intelligence
3. Real PPTX rendering with charts
4. Canva-style beautiful output
"""

import asyncio
from typing import Dict, Any, List
import os
import re
import json
from datetime import datetime

from core.layout_intelligence import LayoutDecisionAgent
from agents.image_agent import ImageAgent
from exporters.html_renderer import HTMLRenderer
from utils.visual_qa import run_visual_qa, route_visual_qa_fixes


# Layouts too spatially dense or structurally unsuited for illustrations
NO_ILLUSTRATION_LAYOUTS = {
    "swot", "pestel", "grid_2x2", "concentric_circles",
    "table", "cycle", "title_only", "thanks",
}

# Layouts that are allowed to receive illustrations
ILLUSTRATION_LAYOUT_WHITELIST = {
    "title_cover",
    "single_column_text",
    "text_left_illustration_right",
    "steps",
    "timeline",
    "timeline_horizontal",
    "timeline_with_backdrop",
    "milestone",
    "items",
    "comparison",
    "split_comparison",
    "comparison_with_center_visual",
    "summary",
    "big_number_stats",
    "big_number",
    "big_number_with_hero_image",
    "pyramid",
    "funnel",
    "quote",
    "three_column_cards",
}

# Illustration-variant layouts that render illustrations natively (not as overlay)
ILLUSTRATION_VARIANT_LAYOUTS = {
    "text_left_illustration_right",
    "big_number_with_hero_image",
    "timeline_with_backdrop",
    "comparison_with_center_visual",
}

# Chart type constraints by high-level intent
INTENT_TO_CHART_TYPES = {
    "market_sizing": ["bar", "column", "line"],
    "trend": ["line", "column"],
    "comparison": ["bar"],
    "distribution": ["pie", "doughnut", "bar"],
    "traction": ["line", "column", "bar"],
}


class AdvancedDeckOrchestrator:
    """
    Main orchestrator that creates professional presentations
    With AI-decided layouts and real chart rendering
    """
    
    def __init__(self, llm_client):
        self.llm_client = llm_client
        self.layout_agent = LayoutDecisionAgent(llm_client)
        from utils.rag_service import RagService
        from utils.deck_qa_agent import DeckQAAgent
        
        # Content generation agents
        from agents.planner_agent import PlannerAgent
        from agents.researcher_agent import ResearcherAgent
        from agents.content_writer_agent import ContentWriterAgent
        from agents.chart_creator_agent import ChartCreatorAgent

        self.planner = PlannerAgent(llm_client)
        self.researcher = ResearcherAgent(llm_client)
        self.content_writer = ContentWriterAgent(llm_client)
        self.chart_creator = ChartCreatorAgent(llm_client)

        base_dir = os.path.dirname(__file__)
        default_uploads = os.path.abspath(os.path.join(base_dir, '..', 'backend', 'uploads'))
        upload_dir = os.getenv('RAG_UPLOAD_DIR', default_uploads)
        self.rag_service = RagService(upload_dir=upload_dir)
        self.deck_qa_agent = DeckQAAgent(llm_client)
        self.image_agent = ImageAgent(llm_client)
        self.design_guidelines = self._get_design_guidelines()
        self.max_concurrency = int(os.getenv("LLM_CONCURRENCY", "4"))

    # NOTE: create_advanced_presentation() and create_presentation_from_slides() removed (PPTX-only)

    def _log_agent_execution(self, agent_name: str, slide_num: int, success: bool, details: str = "") -> None:
        """Log agent execution for debugging."""
        status = "✅" if success else "❌"
        detail_text = f"{details}" if details else ""
        print(f"{status} [{agent_name}] Slide {slide_num}: {detail_text}")

    async def create_advanced_presentation_html(
        self,
        topic: str,
        num_slides: int = 10,
        template_style: str = "corporate",
        tone: str = "professional",
        output_name: str | None = None,
        user_id: int | None = None,
        template_id: str | None = None,
        template_hint: str | None = None,
        logo_path: str | None = None,
    ) -> tuple[str, str, List[str]]:
        """
        Generate an HTML deck using the same multi-agent pipeline.
        """

        strict_schema = str(os.getenv("SLIDE_SCHEMA_STRICT", "")).strip().lower() in {"1", "true", "yes"}
        disable_html_charts = str(
            os.getenv("HTML_DISABLE_CHARTS")
            or os.getenv("HTML_SKIP_CHARTS")
            or ""
        ).strip().lower() in {"1", "true", "yes"}

        print(f"\n🧩 Creating HTML Presentation: {topic}")
        print("=" * 70)
        trace_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        agent_trace: Dict[str, Any] = {
            "trace_id": trace_id,
            "topic": topic,
            "num_slides": num_slides,
            "template_style": template_style,
            "tone": tone,
            "started_at": datetime.now().isoformat(),
            "slides": [],
            "charts_disabled": disable_html_charts,
        }

        # --- Phase 0: RAG evidence extraction ---------------------------------
        try:
            rag_index = self.rag_service.build_index()
            rag_overview = await self.rag_service.retrieve_combined(topic, user_id, top_k=6)
            company_name = self._extract_company_name(rag_overview, topic)
            generated_date = datetime.now().strftime("%Y-%m-%d")
            ir_tables = await self._extract_ir_tables(rag_overview, topic)
            ir_tables_text = self._format_ir_tables(ir_tables) if ir_tables else ""
            rag_count = len(rag_overview) if isinstance(rag_overview, list) else 0
            if rag_count:
                rag_formatted = self.rag_service.format_evidence(rag_overview)
                print(f"\n✅ RAG Phase 0 — Overview retrieval:")
                print(f"   Chunks: {rag_count}")
                print(f"   Company detected: {company_name}")
                print(f"   IR tables found: {len(ir_tables) if ir_tables else 0}")
                print(f"   Evidence preview ({len(rag_formatted)} chars):")
                for line in rag_formatted.split('\n')[:8]:
                    print(f"     {line}")
                if rag_formatted.count('\n') > 8:
                    print(f"     ... ({rag_formatted.count(chr(10)) - 8} more lines)")
            else:
                print(f"⚠️  RAG Phase 0: No chunks retrieved for topic \"{topic[:80]}\"")
        except Exception as exc:
            print(f"⚠️  RAG service failed: {exc} - continuing without RAG context")
            import traceback
            traceback.print_exc()
            rag_overview = ""
            rag_index = None
            company_name = topic
            generated_date = datetime.now().strftime("%Y-%m-%d")
            ir_tables = []
            ir_tables_text = ""

        # --- Phase 1a: Planning (with visual_intent) --------------------------
        print("\n📋 Phase 1a: Planning")
        plan = await self._generate_plan(
            topic, num_slides, template_id, template_hint, rag_overview
        )
        agent_trace["plan"] = plan
        plan_questions = plan.get("questions", []) if isinstance(plan, dict) else []
        if not isinstance(plan_questions, list):
            plan_questions = []

        def _extract_chart_meta(slide: Dict[str, Any]) -> Dict[str, Any] | None:
            chart = slide.get("chart") if isinstance(slide, dict) else None
            if not isinstance(chart, dict):
                return None
            spec = chart.get("chart_spec") if isinstance(chart.get("chart_spec"), dict) else chart.get("chart_spec")
            if not isinstance(spec, dict):
                spec = chart if isinstance(chart, dict) else None
            if not isinstance(spec, dict):
                return None
            return {
                "chart_type": spec.get("chart_type") or spec.get("type"),
                "labels": spec.get("labels") or [],
                "series_name": spec.get("series_name") or spec.get("axes_labels", {}).get("y"),
                "data_points": len(spec.get("data") or []),
                "data": spec.get("data") or [],
            }

        def _has_numbers(slide: Dict[str, Any]) -> bool:
            text_parts = []
            if slide.get("title"):
                text_parts.append(str(slide.get("title")))
            if slide.get("content"):
                text_parts.extend([str(item) for item in (slide.get("content") or [])])
            if slide.get("speaker_notes"):
                text_parts.append(str(slide.get("speaker_notes")))
            joined = " ".join(text_parts)
            return bool(re.search(r"(\$\s*\d|\d+[.,]\d+|\d+\s*[%KMBT]|\d{2,}\s*(billion|million|thousand))", joined, re.IGNORECASE))

        # --- Phase 1b: Enforce prompt requirements ----------------------------
        plan_structure = {'slides': plan['slides'], 'topic': topic}
        plan_structure = self._enforce_prompt_requirements(
            topic,
            plan_structure,
            allow_charts=not disable_html_charts,
        )
        plan['slides'] = plan_structure['slides']
        if disable_html_charts:
            plan = self._disable_chart_intent(plan)
        plan = self._sync_plan_constraints(plan)
        plan = self._limit_visual_intent(plan)
        plan['slides'] = self._validate_slide_schema(
            plan.get('slides', []),
            phase="plan",
            strict=strict_schema,
        )

        # --- Phase 2: Layout decision (early – before content writing) --------
        print("\n🎨 Phase 2: AI Layout Intelligence (early pass)")
        plan_slides_for_layout = []
        for sp in plan['slides']:
            plan_slides_for_layout.append({
                'slide_number': sp.get('slide_number'),
                'title': sp.get('title', ''),
                'content_type': sp.get('content_type', 'text'),
                'content': sp.get('key_points', []),
                'constraints': sp.get('constraints', {}),
                'visual_intent': sp.get('visual_intent', False),
            })
        layouts = await self._decide_layouts({
            'slides': plan_slides_for_layout
        })
        agent_trace["layouts"] = layouts

        # --- Phase 1c: Research -----------------------------------------------
        print("\n🔍 Phase 1c: Research")
        research_results = await self._research_slides(
            plan, topic, rag_index, user_id
        )
        agent_trace["research"] = research_results

        # --- Phase 1d: Content writing (layout-aware) -------------------------
        print("\n✍️  Phase 1d: Content writing (layout-aware)")
        slides_content = await self._write_slide_content(
            plan, research_results, layouts, tone, topic, rag_index, user_id, ir_tables_text
        )
        slides_content = self._validate_slide_schema(
            slides_content,
            phase="content",
            strict=strict_schema,
        )
        agent_trace["content"] = slides_content
        self._attach_branding(slides_content, logo_path, company_name, generated_date)

        # --- Phase 1e: Chart creation -----------------------------------------
        if disable_html_charts:
            print("\n📊 Phase 1e: Chart creation (skipped)")
            slides_content = self._strip_chart_fields(slides_content)
            agent_trace["charts"] = []
        else:
            print("\n📊 Phase 1e: Chart creation")
            slides_content = await self._create_charts(
                slides_content, topic, rag_index, user_id, ir_tables_text
            )
            agent_trace["charts"] = [
                {
                    "slide_number": slide.get("slide_number"),
                    "chart": slide.get("chart"),
                }
                for slide in slides_content
            ]
        slides_content = self._validate_slide_schema(
            slides_content,
            phase="charts",
            strict=strict_schema,
        )
        slides_content, plan_violations = self._enforce_plan_contract(
            plan,
            slides_content,
            allow_charts=not disable_html_charts,
        )
        if plan_violations:
            agent_trace["plan_contract_violations"] = plan_violations

        for idx, slide_plan in enumerate(plan.get("slides", [])):
            agent_trace["slides"].append({
                "slide_number": slide_plan.get("slide_number", idx + 1),
                "plan": slide_plan,
                "research": research_results[idx] if idx < len(research_results) else None,
                "content": slides_content[idx] if idx < len(slides_content) else None,
                "layout": layouts[idx] if idx < len(layouts) else None,
                "chart": slides_content[idx].get("chart") if idx < len(slides_content) else None,
            })

        content_structure = {
            'slides': slides_content,
            'topic': topic,
            'metadata': {
                'created_at': datetime.now().isoformat(),
            },
        }

        # --- Phase 1f: Logic coherence pass -----------------------------------
        print("\n🧠 Phase 1f: Logic coherence pass")
        content_structure = await self._logic_review_and_rewrite(
            content_structure, tone, layouts
        )

        # --- Phase 2a: Illustration enrichment --------------------------------
        print("\n🧩 Phase 2a: Illustration enrichment")
        content_structure, layouts = await self._illustration_enrichment(
            content_structure, layouts
        )

        # --- Phase 2b: Fit content to layout constraints ----------------------
        print("\n✍️  Phase 2b: Fitting content to layout constraints")
        content_structure = await self._fit_content_to_layouts(
            content_structure, layouts, tone
        )

        # --- Phase 2c: Deck-level QA + auto-fix ------------------------------
        print("\n✅ Phase 2c: Deck QA and auto-fix")
        content_structure, layouts = await self._deck_level_qa_and_fix(
            content_structure,
            layouts,
            tone,
            lock_layouts=True,
            allow_charts=not disable_html_charts,
        )

        # --- Phase 2d: Language polish ----------------------------------------
        print("\n✍️  Phase 2d: Language polish")
        content_structure = await self._polish_deck_language(
            content_structure, layouts, tone
        )
        content_structure = self._strip_assumption_markers(content_structure)
        content_structure["slides"] = self._validate_slide_schema(
            content_structure.get("slides", []),
            phase="html",
            strict=strict_schema,
        )

        # --- Phase 3: Render HTML ---------------------------------------------
        print("\n📊 Phase 3: HTML Rendering (with Chart.js)")
        resolved_style = await self._resolve_template_style(
            template_style, topic, tone, template_hint=template_hint
        )
        agent_trace["resolved_style"] = resolved_style
        html_path = await self._render_html(
            content_structure, layouts, resolved_style, output_name=output_name, llm_client=self.llm_client
        )
        json_path = html_path.replace(".html", ".json")
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "topic": topic,
                        "template_style": template_style,
                        "resolved_style": resolved_style,
                        "tone": tone,
                        "plan_questions": plan_questions,
                        "content_structure": content_structure,
                        "layouts": layouts,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                    default=str,
                )
        except Exception as exc:
            print(f"⚠️  Failed to write HTML JSON payload: {exc}")
            json_path = ""

        # --- Phase 4: Visual QA (Gemini Vision) ------------------------------
        enable_visual_qa = os.getenv("ENABLE_HTML_VISUAL_QA", "").lower() in {"1", "true", "yes"}
        max_visual_iters = int(os.getenv("HTML_VISUAL_QA_MAX_ITERS", "1"))
        if enable_visual_qa and self.llm_client:
            print("\n🔍 Phase 4: Visual QA (Gemini Vision)")
            topic_lower = (topic or "").lower()
            deck_type = "ir" if (
                "investor" in topic_lower
                or "ir" in topic_lower
                or "investor relations" in topic_lower
                or "ir deck" in topic_lower
                or "ir" in (template_style or "").lower()
            ) else "general"
            def _build_slides_meta_list() -> list[Dict[str, Any]]:
                return [
                    {
                        "slide_number": slide.get("slide_number"),
                        "title": slide.get("title"),
                        "layout": layouts[idx] if idx < len(layouts) else None,
                        "chart": _extract_chart_meta(slide),
                        "content_type": slide.get("content_type"),
                        "has_numbers": _has_numbers(slide),
                        "has_footnotes": bool(slide.get("footnotes")),
                        "deck_type": deck_type,
                    }
                    for idx, slide in enumerate(content_structure.get("slides", []))
                ]

            def _build_router_meta_map() -> Dict[int, Dict[str, Any]]:
                layout_by_slide = self._build_layout_by_slide(layouts)
                meta_map: Dict[int, Dict[str, Any]] = {}
                for idx, slide in enumerate(content_structure.get("slides", [])):
                    slide_num = self._coerce_slide_number(slide.get("slide_number")) or (idx + 1)
                    layout = layout_by_slide.get(slide_num) or {}
                    meta_map[slide_num] = {
                        "title": slide.get("title"),
                        "layout_type": layout.get("layout_type"),
                        "has_chart": bool(slide.get("chart")),
                        "has_illustration": bool(slide.get("illustration")),
                        "content_items": len(slide.get("content", []) or []),
                        "visual_intent": slide.get("visual_intent", False),
                        "visual_intensity": slide.get("visual_intensity", "low"),
                        "chart": _extract_chart_meta(slide),
                        "content_type": slide.get("content_type"),
                        "has_numbers": _has_numbers(slide),
                        "has_footnotes": bool(slide.get("footnotes")),
                        "deck_type": deck_type,
                    }
                return meta_map

            iteration = 0
            qa_result = None
            while iteration < max_visual_iters:
                slides_meta = _build_slides_meta_list()
                qa_result = await run_visual_qa(self.llm_client, html_path, slides_meta)
                reviews = qa_result.get("reviews", []) if isinstance(qa_result, dict) else []
                needs_fix = []
                for review in reviews:
                    if not isinstance(review, dict):
                        continue
                    issues = review.get("issues") or []
                    has_issues = isinstance(issues, list) and len(issues) > 0
                    if review.get("needs_revision") or has_issues:
                        needs_fix.append(review)

                qa_path = html_path.replace(".html", f"_visual_qa_iter{iteration+1}.json")
                try:
                    with open(qa_path, "w", encoding="utf-8") as f:
                        json.dump(qa_result, f, indent=2, ensure_ascii=False, default=str)
                    agent_trace.setdefault("visual_qa_reports", []).append(qa_path)
                    agent_trace.setdefault("visual_qa_runs", []).append({
                        "iteration": iteration + 1,
                        "report_path": qa_path,
                        "review_count": len(reviews),
                        "issues_count": sum(len(r.get("issues") or []) for r in reviews if isinstance(r, dict)),
                    })
                except Exception as exc:
                    print(f"⚠️  Failed to write visual QA report: {exc}")

                if not needs_fix or iteration + 1 >= max_visual_iters:
                    break

                # Route fixes to specific pipeline steps
                router_meta = _build_router_meta_map()
                routing = await route_visual_qa_fixes(self.llm_client, needs_fix, router_meta)
                agent_trace.setdefault("visual_qa_router", []).append({
                    "iteration": iteration + 1,
                    "decisions": routing,
                })

                # Determine which steps to rerun
                layout_indices: set[int] = set()
                content_indices: set[int] = set()
                chart_indices: set[int] = set()
                render_only = True
                for decision in routing:
                    if not isinstance(decision, dict):
                        continue
                    slide_num = int(decision.get("slide", 0) or 0)
                    if slide_num <= 0:
                        continue
                    idx = slide_num - 1
                    targets = decision.get("fix_targets") or []
                    if isinstance(targets, str):
                        targets = [targets]
                    targets = [str(t).lower() for t in targets]
                    if "layout" in targets:
                        layout_indices.add(idx)
                    if "content" in targets:
                        content_indices.add(idx)
                    if "chart" in targets and not disable_html_charts:
                        chart_indices.add(idx)
                    if any(t in targets for t in ["layout", "content", "chart", "illustration", "theme"]):
                        render_only = False

                # Apply targeted reruns before re-render
                if layout_indices:
                    layouts = await self._redo_layouts_for_indices(
                        plan, layouts, sorted(layout_indices), topic
                    )
                if content_indices:
                    content_structure = await self._regenerate_content_for_indices(
                        plan,
                        research_results,
                        layouts,
                        tone,
                        topic,
                        rag_index,
                        user_id,
                        ir_tables_text,
                        content_structure,
                        sorted(content_indices),
                    )
                if chart_indices and not disable_html_charts:
                    content_structure = await self._regenerate_charts_for_indices(
                        content_structure,
                        sorted(chart_indices),
                        topic,
                        rag_index,
                        user_id,
                        ir_tables_text,
                    )

                if layout_indices or content_indices:
                    content_structure = await self._fit_content_to_layouts(
                        content_structure, layouts, tone
                    )

                # Map QA feedback back to slides for another render attempt.
                # Include structured issues + router instructions so the
                # HTML renderer LLM knows exactly what to fix.
                router_instructions: Dict[int, str] = {}
                for decision in routing:
                    if not isinstance(decision, dict):
                        continue
                    sn = int(decision.get("slide", 0) or 0)
                    instr = decision.get("instructions") or {}
                    render_instr = instr.get("render") or instr.get("layout") or ""
                    if sn > 0 and render_instr:
                        router_instructions[sn] = str(render_instr).strip()

                feedback_map: Dict[int, str] = {}
                for review in needs_fix:
                    slide_idx = int(review.get("slide", 0))
                    if slide_idx <= 0:
                        continue
                    parts: list[str] = []
                    summary = (review.get("summary") or "").strip()
                    if summary:
                        parts.append(f"Summary: {summary}")
                    for item in (review.get("issues") or []):
                        if not isinstance(item, dict) or not item.get("detail"):
                            continue
                        severity = item.get("severity", "medium")
                        parts.append(
                            f"- [{severity.upper()}] {item.get('type', 'issue')}: {item['detail']}"
                        )
                    instr = router_instructions.get(slide_idx)
                    if instr:
                        parts.append(f"Fix guidance: {instr}")
                    if parts:
                        feedback_map[slide_idx] = "\n".join(parts)

                if feedback_map:
                    for idx, slide in enumerate(content_structure.get("slides", []), start=1):
                        if idx in feedback_map:
                            slide["visual_qa_feedback"] = feedback_map[idx]
                        else:
                            slide.pop("visual_qa_feedback", None)

                iteration += 1
                print(f"🔁 Visual QA iteration {iteration+1}/{max_visual_iters}: re-rendering HTML")
                html_path = await self._render_html(
                    content_structure, layouts, resolved_style, output_name=output_name, llm_client=self.llm_client
                )

            if qa_result:
                agent_trace["visual_qa"] = {
                    "images": qa_result.get("images", []),
                    "review_count": len(qa_result.get("reviews", [])),
                }
                agent_trace["visual_qa_reviews"] = qa_result.get("reviews", [])

        agent_trace["completed_at"] = datetime.now().isoformat()
        agent_trace["output_html"] = html_path
        if json_path:
            agent_trace["output_json"] = json_path
        self._write_agent_trace(agent_trace)

        print(f"\n✅ Complete! Saved to: {html_path}")
        return html_path, json_path, plan_questions

    @staticmethod
    def _disable_chart_intent(plan: Dict[str, Any]) -> Dict[str, Any]:
        """Downgrade chart slides/constraints when HTML charts are disabled."""
        slides = plan.get("slides", [])
        for slide in slides:
            if slide.get("content_type") == "chart":
                slide["content_type"] = "text"
            constraints = slide.get("constraints")
            if isinstance(constraints, dict):
                if constraints.get("content_type") == "chart":
                    constraints["content_type"] = slide.get("content_type", "text")
                constraints["must_render_chart"] = False
                constraints["allowed_chart_types"] = []
                if isinstance(constraints.get("required_fields"), list):
                    constraints["required_fields"] = [
                        f for f in constraints["required_fields"] if f != "chart"
                    ]
            slide["constraints"] = constraints
        plan["slides"] = slides
        return plan

    @staticmethod
    def _strip_chart_fields(slides_content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove chart payloads from slide content."""
        for slide in slides_content:
            if isinstance(slide, dict):
                slide.pop("chart", None)
        return slides_content

    @staticmethod
    def _validate_slide_schema(
        slides: List[Dict[str, Any]],
        phase: str,
        strict: bool = False,
    ) -> List[Dict[str, Any]]:
        """Validate and normalize slide schema to avoid downstream mismatches."""
        if not isinstance(slides, list):
            msg = f"[schema] {phase}: slides is not a list"
            if strict:
                raise ValueError(msg)
            print(f"⚠️  {msg}")
            return []

        warnings: List[str] = []
        for idx, slide in enumerate(slides):
            if not isinstance(slide, dict):
                msg = f"[schema] {phase}: slide {idx+1} is not a dict"
                if strict:
                    raise ValueError(msg)
                warnings.append(msg)
                continue

            if not slide.get("slide_number"):
                slide["slide_number"] = idx + 1
                warnings.append(f"[schema] {phase}: slide {idx+1} missing slide_number")

            title = slide.get("title")
            if title is None:
                slide["title"] = ""
                warnings.append(f"[schema] {phase}: slide {slide['slide_number']} missing title")

            ctype = slide.get("content_type")
            if not ctype:
                slide["content_type"] = "text"
                warnings.append(f"[schema] {phase}: slide {slide['slide_number']} missing content_type")
            else:
                slide["content_type"] = str(ctype)

            # Normalize content
            content = slide.get("content")
            if content in (None, ""):
                key_points = slide.get("key_points")
                if isinstance(key_points, list) and key_points:
                    slide["content"] = [str(x) for x in key_points if str(x).strip()]
                    warnings.append(f"[schema] {phase}: slide {slide['slide_number']} content derived from key_points")
                else:
                    slide["content"] = []
            elif not isinstance(content, list):
                slide["content"] = [str(content)]
                warnings.append(f"[schema] {phase}: slide {slide['slide_number']} content normalized to list")
            else:
                slide["content"] = [str(x) for x in content if str(x).strip()]

            if "subtitle" in slide and slide.get("subtitle") is None:
                slide["subtitle"] = ""

            if "constraints" in slide and not isinstance(slide.get("constraints"), dict):
                slide["constraints"] = {}
                warnings.append(f"[schema] {phase}: slide {slide['slide_number']} constraints normalized to dict")

            # Normalize chart shape if present
            chart = slide.get("chart")
            if chart is not None:
                if isinstance(chart, dict):
                    if "chart_spec" not in chart and any(k in chart for k in ("chart_type", "data", "labels", "title", "axes_labels")):
                        slide["chart"] = {"chart_spec": chart}
                        warnings.append(f"[schema] {phase}: slide {slide['slide_number']} chart wrapped into chart_spec")
                else:
                    slide["chart"] = {"chart_spec": chart}
                    warnings.append(f"[schema] {phase}: slide {slide['slide_number']} chart normalized to dict")

            # Normalize comparison buckets
            if "left_items" in slide and not isinstance(slide.get("left_items"), list):
                slide["left_items"] = [str(slide.get("left_items"))]
            if "right_items" in slide and not isinstance(slide.get("right_items"), list):
                slide["right_items"] = [str(slide.get("right_items"))]

        if warnings:
            print(f"⚠️  Schema warnings ({phase}):")
            for w in warnings[:20]:
                print(f"   - {w}")
            if len(warnings) > 20:
                print(f"   - ...and {len(warnings) - 20} more")

        return slides

    def _coerce_slide_number(self, value: Any) -> int | None:
        """Best-effort normalization for slide_number to avoid unhashable keys."""
        if isinstance(value, dict):
            for key in ("slide_number", "number", "index", "id"):
                if key in value:
                    return self._coerce_slide_number(value[key])
            return None
        if isinstance(value, (int, str)):
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
        return None

    def _build_layout_by_slide(self, layouts: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        layout_by_slide: Dict[int, Dict[str, Any]] = {}
        for layout in layouts or []:
            if not isinstance(layout, dict):
                continue
            key = self._coerce_slide_number(layout.get("slide_number"))
            if key is None:
                continue
            layout_by_slide[key] = layout
        return layout_by_slide

    def _write_agent_trace(self, trace: Dict[str, Any]) -> None:
        """Persist agent outputs for debugging coherence issues."""
        trace_dir = os.getenv("AGENT_TRACE_DIR", "/tmp")
        os.makedirs(trace_dir, exist_ok=True)
        trace_id = trace.get("trace_id") or datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(trace_dir, f"agent_trace_{trace_id}.json")
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(trace, f, indent=2, ensure_ascii=False, default=str)
            print(f"\n🧾 Agent trace saved: {filepath}")
        except Exception as exc:
            print(f"\n⚠️  Failed to write agent trace: {exc}")

    @staticmethod
    def _extract_company_name(rag_overview: list | None, topic: str) -> str:
        """Heuristic company name extraction from RAG evidence."""
        if not rag_overview:
            return ""
        text = " ".join(chunk.text for chunk in rag_overview if hasattr(chunk, "text"))
        patterns = [
            r"Company Name[:\s]+([A-Z][A-Za-z0-9&.\- ]{2,40})",
            r"Organization[:\s]+([A-Z][A-Za-z0-9&.\- ]{2,40})",
            r"^([A-Z][A-Za-z0-9&.\- ]{2,40})\s+(Inc\.|LLC|Ltd\.|Limited|Corp\.|Corporation)",
        ]
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return ""

    async def _extract_ir_tables(self, rag_overview: list | None, topic: str) -> Dict[str, Any]:
        """Extract IR deck canonical tables from RAG context."""
        if not rag_overview:
            return {}
        if not self._is_ir_topic(topic):
            return {}

        rag_context = self.rag_service.format_evidence(rag_overview)
        system_prompt = """
You extract structured IR-deck data tables from provided evidence.
Return valid JSON only. Do NOT invent facts.
If a table is missing, return an empty list for that key.
"""
        user_prompt = f"""
EVIDENCE:
{rag_context}

Return JSON with these keys (arrays of objects):
- market_sizing_table (year, size, currency, geo, segment, source)
- segmentation_table (segment, value_or_share, basis, source)
- problem_impact_table (problem, persona, impact_metric, evidence, source)
- tamsamsom_table (tam, sam, som, year, currency, basis, source)
- tech_objective_table (objective, metric, target, status, proof, source)
- timeline_table (milestone, date_or_phase, owner, acceptance_criteria, source)
- competition_table (competitor, positioning, differentiator, price_model, weakness, source)
- gtm_plan_table (phase, channel, activities, kpi, timeline, source)
- kpi_target_table (kpi, target, period, rationale, assumption, source)
- hiring_table (function, headcount, timing, rationale, source)
- compliance_controls_table (area, risk, control, status, evidence, owner, source)
"""
        try:
            return await self.llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1800,
                response_format="json",
            )
        except Exception:
            return {}

    def _format_ir_tables(self, tables: Dict[str, Any]) -> str:
        if not tables:
            return ""
        lines = ["IR DATA TABLES (use these; do not invent facts):"]
        for key, rows in tables.items():
            if not rows:
                continue
            lines.append(f"\n{key}:")
            for row in rows[:6]:
                if isinstance(row, dict):
                    parts = [f"{k}={v}" for k, v in row.items() if v not in (None, "", [], {})]
                    if parts:
                        lines.append("- " + "; ".join(parts))
        return "\n".join(lines)

    @staticmethod
    def _strip_assumption_markers(content_structure: Dict[str, Any]) -> Dict[str, Any]:
        """Remove assumption labels from slide text and chart titles."""
        def clean_text(text: str) -> str:
            if not text:
                return text
            cleaned = re.sub(r'^\s*assumption[:\-\s]+', '', text, flags=re.IGNORECASE)
            cleaned = re.sub(r'\s*\(assumption\)\s*', '', cleaned, flags=re.IGNORECASE)
            return cleaned.strip()

        slides = content_structure.get('slides', [])
        for slide in slides:
            title = slide.get('title')
            if isinstance(title, str):
                slide['title'] = clean_text(title)

            content_items = slide.get('content', [])
            if isinstance(content_items, list):
                slide['content'] = [clean_text(str(item)) for item in content_items if str(item).strip()]

            speaker_notes = slide.get('speaker_notes')
            if isinstance(speaker_notes, str):
                slide['speaker_notes'] = clean_text(speaker_notes)

            chart = slide.get('chart')
            if isinstance(chart, dict):
                chart_spec = chart.get('chart_spec')
                if isinstance(chart_spec, dict):
                    chart_title = chart_spec.get('title')
                    if isinstance(chart_title, str):
                        chart_spec['title'] = clean_text(chart_title)

            if 'footnotes' in slide:
                slide.pop('footnotes', None)

        content_structure['slides'] = slides
        return content_structure

    def _is_ir_topic(self, topic: str) -> bool:
        q = (topic or "").lower()
        ir_signals = [
            "ir", "investor", "grant", "market status", "commercialization",
            "r&d", "rd", "compliance", "security", "safety", "pestel", "swot",
            "tam", "sam", "som", "go-to-market", "competitive landscape",
        ]
        return any(sig in q for sig in ir_signals)

    @staticmethod
    def _attach_branding(
        slides: List[Dict[str, Any]],
        logo_path: str | None,
        company_name: str,
        generated_date: str
    ) -> None:
        for slide in slides:
            if logo_path:
                slide["logo_path"] = logo_path
            if slide.get("content_type") == "title":
                slide["company_name"] = company_name
                slide["generated_date"] = generated_date

    # ------------------------------------------------------------------
    # Split content-generation helpers
    # ------------------------------------------------------------------

    async def _generate_plan(
        self,
        topic: str,
        num_slides: int,
        template_id: str | None,
        template_hint: str | None,
        rag_overview: list | None,
    ) -> Dict[str, Any]:
        """Phase 1a – planning only (returns plan dict with visual_intent)."""
        print("   → Planning presentation structure...")
        preferences: Dict[str, Any] = {}
        if template_id:
            preferences['template_id'] = template_id
        if template_hint:
            preferences['template_hint'] = template_hint
        if rag_overview:
            preferences['rag_context'] = self.rag_service.format_evidence(rag_overview)
        if self.design_guidelines:
            preferences['design_guidelines'] = self.design_guidelines

        plan = await self.planner.execute({
            'topic': topic,
            'num_slides': num_slides,
            'style': 'professional',
            'preferences': preferences,
        })
        return plan

    def _limit_visual_intent(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Keep visual_intent limited to title + problem + product slides.
        Everything else is forced to visual_intent=False.
        """
        slides = plan.get("slides", [])
        if not slides:
            return plan

        title_idx = None
        problem_idx = None
        product_idx = None

        def _match_any(text: str, keywords: list[str]) -> bool:
            t = text.lower()
            return any(k in t for k in keywords)

        for i, slide in enumerate(slides):
            title = str(slide.get("title", ""))
            content_type = str(slide.get("content_type", ""))
            if title_idx is None and (slide.get("slide_number") == 1 or _match_any(title, ["title", "cover"]) or content_type == "title"):
                title_idx = i
            if problem_idx is None and _match_any(title, ["problem", "pain", "challenge", "threat", "risk", "market pain"]):
                problem_idx = i
            if product_idx is None and _match_any(title, ["product", "solution", "platform", "overview", "technology"]):
                product_idx = i

        allowed = {idx for idx in (title_idx, problem_idx, product_idx) if idx is not None}

        def _normalize_intensity(value: Any) -> str | None:
            if not isinstance(value, str):
                return None
            value = value.strip().lower()
            return value if value in {"low", "medium", "high", "hero"} else None

        for i, slide in enumerate(slides):
            is_allowed = i in allowed
            slide["visual_intent"] = is_allowed
            intensity = _normalize_intensity(slide.get("visual_intensity"))
            if is_allowed:
                if not intensity:
                    intensity = "hero" if i == title_idx else "medium"
            else:
                intensity = "low"
            slide["visual_intensity"] = intensity

            # Ensure visual_composition exists for downstream prompts (no coordinates)
            if "visual_composition" not in slide or not isinstance(slide.get("visual_composition"), dict):
                slide["visual_composition"] = {
                    "style": "clean / balanced",
                    "metaphor": "",
                    "primary_visual": "chart" if str(slide.get("content_type")) in {"chart", "concentric_circles"} else "typography",
                    "mood": "confident",
                    "allowed_elements": ["icons", "decorative SVG", "accent bars"],
                }

        plan["slides"] = slides
        return plan

    @staticmethod
    def _default_constraints_for_type(content_type: str) -> Dict[str, Any]:
        ctype = str(content_type or 'text')
        constraints = {
            "intent": "",
            "content_type": ctype,
            "allowed_chart_types": [],
            "must_render_chart": False,
            "required_fields": [],
            "required_labels": [],
            "left_label": "",
            "right_label": "",
            "comparison_axis": "",
            "numeric_required": False,
            "visual_required": False,
        }
        if ctype == "chart":
            constraints["allowed_chart_types"] = ["bar", "column", "line", "pie", "doughnut", "area"]
            constraints["must_render_chart"] = True
            constraints["required_fields"] = ["chart"]
            constraints["numeric_required"] = True
            constraints["visual_required"] = True
        elif ctype == "concentric_circles":
            constraints["allowed_chart_types"] = ["concentric_circles"]
            constraints["required_fields"] = ["content", "explanation"]
            constraints["required_labels"] = ["TAM", "SAM", "SOM"]
            constraints["numeric_required"] = True
            constraints["visual_required"] = True
        elif ctype in {"table", "big_number"}:
            constraints["required_fields"] = ["content"]
            constraints["numeric_required"] = True
            constraints["visual_required"] = True
        elif ctype == "comparison":
            constraints["required_fields"] = ["left_items", "right_items"]
            constraints["visual_required"] = True
        elif ctype in {"timeline", "milestone", "pestel", "swot", "pyramid", "funnel", "cycle", "steps", "items"}:
            constraints["required_fields"] = ["content"]
            constraints["visual_required"] = True
        return constraints

    def _sync_plan_constraints(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        slides = plan.get("slides", [])
        for slide in slides:
            ctype = slide.get("content_type", "text")
            if not slide.get("intent"):
                slide["intent"] = self._derive_intent(slide)
            defaults = self._default_constraints_for_type(ctype)
            constraints = slide.get("constraints")
            if not isinstance(constraints, dict):
                constraints = defaults
            else:
                # If the enforcer changed content_type (e.g. text→chart),
                # force-sync all constraint fields from the new type defaults.
                type_changed = constraints.get("content_type", "") != ctype
                constraints["content_type"] = ctype
                if type_changed or constraints.get("allowed_chart_types") in (None, []):
                    constraints["allowed_chart_types"] = defaults["allowed_chart_types"]
                if type_changed or "must_render_chart" not in constraints:
                    constraints["must_render_chart"] = defaults["must_render_chart"]
                if type_changed or not constraints.get("required_fields"):
                    constraints["required_fields"] = defaults["required_fields"]
                if not constraints.get("required_labels"):
                    constraints["required_labels"] = defaults["required_labels"]
                if type_changed or "left_label" not in constraints:
                    constraints["left_label"] = defaults.get("left_label", "")
                if type_changed or "right_label" not in constraints:
                    constraints["right_label"] = defaults.get("right_label", "")
                if type_changed or "comparison_axis" not in constraints:
                    constraints["comparison_axis"] = defaults.get("comparison_axis", "")
                if type_changed or "numeric_required" not in constraints:
                    constraints["numeric_required"] = defaults["numeric_required"]
                if type_changed or "visual_required" not in constraints:
                    constraints["visual_required"] = defaults["visual_required"]
            if not constraints.get("intent"):
                constraints["intent"] = slide.get("intent", "")

            if ctype == "comparison":
                derived = self._derive_comparison_labels(slide)
                if not constraints.get("left_label"):
                    constraints["left_label"] = derived["left_label"]
                if not constraints.get("right_label"):
                    constraints["right_label"] = derived["right_label"]
                if not constraints.get("comparison_axis"):
                    constraints["comparison_axis"] = derived["comparison_axis"]

            # Collapse chart-type choice into lookup tables when intent is known.
            if constraints.get("content_type") == "chart" and not constraints.get("allowed_chart_types"):
                intent = (constraints.get("intent") or slide.get("intent") or "").lower()
                if intent in INTENT_TO_CHART_TYPES:
                    constraints["allowed_chart_types"] = INTENT_TO_CHART_TYPES[intent]
            slide["constraints"] = constraints
        plan["slides"] = slides
        return plan

    @staticmethod
    def _derive_intent(slide: Dict[str, Any]) -> str:
        title = str(slide.get("title", "")).lower()
        content_type = str(slide.get("content_type", "")).lower()
        if content_type == "concentric_circles" or any(k in title for k in ("tam", "sam", "som", "market size")):
            return "market_sizing"
        if any(k in title for k in ("problem", "pain", "challenge", "risk", "threat")):
            return "problem"
        if any(k in title for k in ("solution", "platform", "product", "technology")):
            return "solution"
        if any(k in title for k in ("roadmap", "timeline", "milestone")):
            return "roadmap"
        if any(k in title for k in ("commercial", "go-to-market", "gtm", "competition", "competitive")):
            return "commercialization"
        if any(k in title for k in ("team", "company", "introduction")):
            return "company_intro"
        if any(k in title for k in ("security", "safety", "compliance", "regulatory")):
            return "compliance"
        if content_type == "chart":
            return "traction"
        return "other"

    @staticmethod
    def _derive_comparison_labels(slide: Dict[str, Any]) -> Dict[str, str]:
        title = str(slide.get("title", "")).strip()
        def _stringify_point(item: Any) -> str:
            if item is None:
                return ""
            if isinstance(item, dict):
                for key in ("text", "title", "label", "value", "content", "point"):
                    val = item.get(key)
                    if val:
                        return str(val)
                parts: List[str] = []
                for val in item.values():
                    if val is None:
                        continue
                    if isinstance(val, (str, int, float)):
                        parts.append(str(val))
                    elif isinstance(val, list):
                        parts.extend(
                            str(v) for v in val if v is not None and isinstance(v, (str, int, float))
                        )
                return " ".join(parts).strip()
            if isinstance(item, list):
                return " ".join(str(v) for v in item if v is not None)
            return str(item)

        key_points = " ".join(
            kp for kp in (_stringify_point(kp) for kp in (slide.get("key_points", []) or [])) if kp
        )
        text = f"{title} {key_points}".strip().lower()

        def _clean_label(raw: str) -> str:
            words = [w for w in re.split(r"\s+", raw.strip()) if w]
            return " ".join(words[:4]) if words else raw.strip()

        # Try to parse "X vs Y" from title
        match = re.search(r"(.+?)\s+vs\.?\s+(.+)", title, re.IGNORECASE)
        if match:
            left = _clean_label(match.group(1))
            right = _clean_label(match.group(2))
            return {
                "left_label": left or "Current State",
                "right_label": right or "Target State",
                "comparison_axis": "Key attributes",
            }

        if "before" in text and "after" in text:
            return {"left_label": "Before", "right_label": "After", "comparison_axis": "Key attributes"}
        if any(k in text for k in ("legacy", "current", "today", "as-is")):
            return {"left_label": "Current State", "right_label": "Target State", "comparison_axis": "Key attributes"}
        if any(k in text for k in ("modern", "future", "next", "ai-driven", "automated")):
            return {"left_label": "Legacy Approach", "right_label": "Modern Approach", "comparison_axis": "Key attributes"}

        # Axis hints
        axis = "Key attributes"
        if "cost" in text:
            axis = "Cost"
        elif "speed" in text or "time" in text:
            axis = "Speed"
        elif "risk" in text:
            axis = "Risk"
        elif "performance" in text:
            axis = "Performance"
        elif "efficiency" in text:
            axis = "Efficiency"

        return {"left_label": "Current State", "right_label": "Target State", "comparison_axis": axis}

    @staticmethod
    def _comparison_tokenize(text: str) -> set:
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        stop = {
            "the", "and", "or", "of", "to", "in", "for", "on", "with", "by",
            "a", "an", "is", "are", "be", "as", "at", "from", "this", "that",
            "vs", "versus",
        }
        return {t for t in tokens if t not in stop}

    @classmethod
    def _comparison_items_too_similar(cls, left_items: List[str], right_items: List[str]) -> bool:
        if not left_items or not right_items:
            return True
        left_tokens = set().union(*(cls._comparison_tokenize(item) for item in left_items if item))
        right_tokens = set().union(*(cls._comparison_tokenize(item) for item in right_items if item))
        if not left_tokens or not right_tokens:
            return True
        union = left_tokens.union(right_tokens)
        overlap = left_tokens.intersection(right_tokens)
        agg_jaccard = len(overlap) / max(len(union), 1)

        max_pair = 0.0
        for l in left_items:
            l_tokens = cls._comparison_tokenize(l)
            if not l_tokens:
                continue
            for r in right_items:
                r_tokens = cls._comparison_tokenize(r)
                if not r_tokens:
                    continue
                pair_union = l_tokens.union(r_tokens)
                pair_overlap = l_tokens.intersection(r_tokens)
                sim = len(pair_overlap) / max(len(pair_union), 1)
                max_pair = max(max_pair, sim)

        return agg_jaccard > 0.55 or max_pair > 0.75

    @staticmethod
    def _rebalance_comparison_items(items: List[str]) -> tuple[List[str], List[str]]:
        left_cues = {
            "current", "today", "legacy", "manual", "reactive", "fragmented", "siloed",
            "slow", "costly", "limited", "pain", "risk", "breach", "compliance",
            "after-the-fact", "lagging",
        }
        right_cues = {
            "target", "future", "modern", "automated", "proactive", "unified", "ai",
            "real-time", "fast", "efficient", "scalable", "secure", "optimized",
            "predictive", "resilient",
        }
        left: List[str] = []
        right: List[str] = []
        toggle_left = True

        for item in items:
            tokens = {t.lower() for t in re.findall(r"[a-z0-9\-]+", str(item))}
            left_score = len(tokens.intersection(left_cues))
            right_score = len(tokens.intersection(right_cues))
            if left_score > right_score:
                left.append(item)
            elif right_score > left_score:
                right.append(item)
            else:
                if toggle_left:
                    left.append(item)
                else:
                    right.append(item)
                toggle_left = not toggle_left

        if not left or not right:
            mid = max(1, len(items) // 2)
            left = items[:mid]
            right = items[mid:]

        while len(left) < 2 and right:
            left.append(right.pop(0))
        while len(right) < 2 and left:
            right.append(left.pop())

        return left[:5], right[:5]

    async def _research_slides(
        self,
        plan: Dict[str, Any],
        topic: str,
        rag_index: list | None,
        user_id: int | None,
    ) -> list:
        """Phase 1c – parallel research per slide.

        Also stores formatted RAG evidence in each result so downstream
        phases (content writing, chart creation) can reuse it without
        making duplicate retrieve_combined calls.
        """
        print("   → Researching content...")
        # Build a short topic prefix (first line, max 120 chars) to avoid
        # passing the entire multi-paragraph prompt as the RAG query.
        topic_short = (topic or "").split("\n")[0][:120].strip()

        research_tasks = []
        for slide in plan['slides']:
            slide_num = slide.get('slide_number', 0)
            def _stringify_kp(item: Any) -> str:
                if item is None:
                    return ""
                if isinstance(item, dict):
                    for key in ("text", "title", "label", "value", "content", "point", "name", "description"):
                        val = item.get(key)
                        if val:
                            return str(val)
                    parts: List[str] = []
                    for val in item.values():
                        if val is None:
                            continue
                        if isinstance(val, (str, int, float)):
                            parts.append(str(val))
                        elif isinstance(val, list):
                            parts.extend(
                                str(v) for v in val if v is not None and isinstance(v, (str, int, float))
                            )
                    return " ".join(parts).strip()
                if isinstance(item, list):
                    return " ".join(str(v) for v in item if v is not None)
                return str(item)

            key_points_raw = slide.get('key_points', []) or []
            if not isinstance(key_points_raw, list):
                key_points_raw = [key_points_raw]
            key_points_text = " ".join(
                kp for kp in (_stringify_kp(kp) for kp in key_points_raw) if kp
            )
            slide_query = f"{topic_short} {slide.get('title', '')} {key_points_text}".strip()
            content_type = slide.get('content_type', 'text')
            require_numbers = content_type in {
                'chart', 'table', 'big_number', 'concentric_circles',
                'timeline', 'milestone',
            }
            rag_evidence: list = []
            if rag_index is not None:
                try:
                    rag_evidence = await self.rag_service.retrieve_combined(
                        slide_query, user_id, top_k=4, require_numbers=require_numbers
                    )
                except Exception as exc:
                    print(f"⚠️  RAG retrieve failed for slide {slide_num}: {exc}")
            formatted_rag = (
                self.rag_service.format_evidence(rag_evidence) if rag_evidence else ''
            )
            if formatted_rag:
                print(f"   📎 Slide {slide_num} RAG evidence ({len(rag_evidence)} chunks, {len(formatted_rag)} chars)")
            else:
                print(f"   📎 Slide {slide_num}: no RAG evidence")
            # Dynamic research depth based on content type
            if content_type in {'chart', 'table', 'big_number', 'concentric_circles'}:
                depth = 'deep'
            elif content_type in {'title', 'thanks', 'quote'}:
                depth = 'light'
            else:
                depth = 'moderate'

            async def _run_research(slide_payload: Dict[str, Any], fmt_rag: str, depth_level: str, num: int) -> Dict[str, Any]:
                try:
                    result = await self.researcher.execute({
                        'slide': slide_payload,
                        'instruction': slide_payload.get('instruction', ''),
                        'depth': depth_level,
                        'topic': topic,
                        'rag_evidence': fmt_rag,
                        'design_guidelines': self.design_guidelines,
                    })
                    if not isinstance(result, dict):
                        self._log_agent_execution("Researcher", num, False, f"Invalid type: {type(result)}")
                        result = {'facts': [], 'statistics': {}, 'examples': [], 'chart_data': None}
                    else:
                        self._log_agent_execution(
                            "Researcher",
                            num,
                            True,
                            f"{len(result.get('facts') or [])} facts"
                        )
                except Exception as exc:
                    self._log_agent_execution("Researcher", num, False, str(exc))
                    result = {
                        'facts': [],
                        'statistics': {},
                        'examples': [],
                        'chart_data': None,
                    }
                return result

            task = _run_research(slide, formatted_rag, depth, slide_num)
            # Wrap task so we can attach the formatted RAG evidence to the
            # result dict for reuse in later phases.
            research_tasks.append((task, formatted_rag))

        raw_results = await asyncio.gather(*[t for t, _ in research_tasks])
        results = []
        for (_, fmt_rag), res in zip(research_tasks, raw_results):
            if isinstance(res, dict):
                res['_rag_evidence'] = fmt_rag
                res['normalized_facts'] = self._normalize_research_payload(res)
            results.append(res)
        return results

    @staticmethod
    def _normalize_research_payload(research: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Normalize research facts/statistics into a consistent numeric schema."""
        normalized: List[Dict[str, Any]] = []

        def parse_number(text: str) -> tuple[float | None, str]:
            import re
            if not text:
                return None, ""
            # Prefer currency or percent
            pattern = re.compile(r'([$€£])?\s*([0-9]+(?:\.[0-9]+)?)\s*([KMBT]|%|bn|billion|million|thousand)?', re.IGNORECASE)
            match = pattern.search(text)
            if not match:
                return None, ""
            symbol, num_str, suffix = match.groups()
            try:
                value = float(num_str)
            except ValueError:
                return None, ""
            unit = ""
            multiplier = 1.0
            if symbol:
                unit = symbol
            if suffix:
                s = suffix.lower()
                if s in {"k", "thousand"}:
                    multiplier = 1_000
                    unit = unit or "K"
                elif s in {"m", "million"}:
                    multiplier = 1_000_000
                    unit = unit or "M"
                elif s in {"b", "bn", "billion"}:
                    multiplier = 1_000_000_000
                    unit = unit or "B"
                elif s in {"t"}:
                    multiplier = 1_000_000_000_000
                    unit = unit or "T"
                elif s == "%":
                    unit = "%"
            return value * multiplier, unit

        for fact in research.get("facts", []) or []:
            text = str(fact)
            assumption = text.strip().lower().startswith("assumption")
            cleaned = re.sub(r'^assumption[:\-\s]+', '', text, flags=re.IGNORECASE).strip()
            value, unit = parse_number(cleaned)
            if value is None:
                continue
            normalized.append({
                "metric": "fact",
                "value": value,
                "unit": unit,
                "assumption": assumption,
                "raw": cleaned,
            })

        stats = research.get("statistics") or {}
        if isinstance(stats, dict):
            for key, val in stats.items():
                text = f"{key}: {val}"
                assumption = str(val).strip().lower().startswith("assumption")
                cleaned = re.sub(r'^assumption[:\-\s]+', '', str(val), flags=re.IGNORECASE).strip()
                value, unit = parse_number(cleaned)
                if value is None:
                    continue
                normalized.append({
                    "metric": key,
                    "value": value,
                    "unit": unit,
                    "assumption": assumption,
                    "raw": cleaned,
                })

        return normalized

    async def _write_slide_content(
        self,
        plan: Dict[str, Any],
        research_results: list,
        layouts: List[Dict[str, Any]],
        tone: str,
        topic: str,
        rag_index: list | None,
        user_id: int | None,
        ir_tables_text: str = "",
    ) -> list:
        """Phase 1d – content writing WITH layout constraints + has_illustration.

        Reuses RAG evidence stored in research_results['_rag_evidence']
        from Phase 1c to avoid duplicate retrieve_combined calls.
        """
        print("   → Writing slide content...")
        layout_by_slide = self._build_layout_by_slide(layouts)
        sem = asyncio.Semaphore(self.max_concurrency)

        all_slides = plan['slides']

        async def _build_slide(i: int, slide_plan: Dict[str, Any]) -> Dict[str, Any]:
            async with sem:
                research = research_results[i] if i < len(research_results) else {}
                # Reuse RAG evidence from research phase (no duplicate fetch)
                rag_evidence_str = research.get('_rag_evidence', '') if isinstance(research, dict) else ''
                research_chart_data = research.get('chart_data') if isinstance(research, dict) else None

                slide_num = self._coerce_slide_number(slide_plan.get('slide_number')) or (i + 1)
                layout = layout_by_slide.get(slide_num, {})
                layout_type = layout.get('layout_type', 'single_column_text')
                constraints = self._get_layout_constraints(layout_type)
                has_illustration = (
                    slide_plan.get('visual_intent', False)
                    and layout_type not in NO_ILLUSTRATION_LAYOUTS
                )

                # Adjacent slide context for narrative continuity
                prev_title = all_slides[i - 1].get('title', '') if i > 0 else ''
                next_title = all_slides[i + 1].get('title', '') if i < len(all_slides) - 1 else ''

                try:
                    result = await self.content_writer.execute({
                        'plan': slide_plan,
                        'research': research,
                        'instruction': slide_plan.get('instruction', ''),
                        'tone': tone,
                        'constraints': constraints,
                        'plan_constraints': slide_plan.get('constraints', {}),
                        'has_illustration': has_illustration,
                        'rag_evidence': rag_evidence_str,
                        'ir_tables': ir_tables_text,
                        'design_guidelines': self.design_guidelines,
                        'prev_title': prev_title,
                        'next_title': next_title,
                    })
                    self._log_agent_execution("ContentWriter", slide_num, True)
                except Exception as exc:
                    self._log_agent_execution("ContentWriter", slide_num, False, str(exc))
                    result = {
                        'title': slide_plan.get('title', f'Slide {slide_num}'),
                        'content': ['Content generation failed - placeholder'],
                        'content_type': slide_plan.get('content_type', 'text'),
                        'slide_number': slide_num,
                        'speaker_notes': f'Error: {str(exc)}',
                        'error': str(exc),
                    }

                if not isinstance(result, dict):
                    print(f"❌ ContentWriter returned invalid type for slide {slide_num}: {type(result)}")
                    result = {
                        'title': slide_plan.get('title', f'Slide {slide_num}'),
                        'content': [],
                        'content_type': slide_plan.get('content_type', 'text'),
                        'slide_number': slide_num,
                    }
                if 'content' in result and not isinstance(result['content'], list):
                    print(f"⚠️  ContentWriter returned non-list content for slide {slide_num}, converting")
                    if isinstance(result['content'], str):
                        result['content'] = [result['content']]
                    else:
                        result['content'] = []
                # Carry RAG evidence forward so chart creation can reuse it
                if isinstance(result, dict) and rag_evidence_str:
                    result['_rag_evidence'] = rag_evidence_str
                if isinstance(result, dict) and research_chart_data:
                    result['_research_chart_data'] = research_chart_data
                if isinstance(result, dict):
                    result['_plan_constraints'] = slide_plan.get('constraints', {})
                return result

        async def _generate_slide_content_safe(i: int, slide_plan: Dict[str, Any]) -> Dict[str, Any]:
            """
            Wrapper for slide generation with comprehensive error handling.
            Ensures one bad slide doesn't kill entire presentation.
            """
            slide_num = slide_plan.get('slide_number', i + 1)
            try:
                return await _build_slide(i, slide_plan)
            except Exception as exc:
                print(f"❌ CRITICAL: Slide {slide_num} generation failed: {exc}")
                import traceback
                traceback.print_exc()
                return {
                    'slide_number': slide_num,
                    'title': slide_plan.get('title', f'Slide {slide_num}'),
                    'content': ['Content generation failed - using placeholder'],
                    'content_type': slide_plan.get('content_type', 'text'),
                    'speaker_notes': f'Error: {str(exc)}',
                    'error': str(exc),
                }

        slides_content = list(await asyncio.gather(*[
            _generate_slide_content_safe(i, slide_plan) for i, slide_plan in enumerate(plan['slides'])
        ]))

        # Propagate visual_intent from plan to content slides
        for i, slide in enumerate(slides_content):
            if i < len(plan['slides']):
                slide['visual_intent'] = plan['slides'][i].get('visual_intent', False)
                slide['visual_intensity'] = plan['slides'][i].get('visual_intensity', 'low')
                slide['visual_composition'] = plan['slides'][i].get('visual_composition', {})

        return slides_content

    async def _create_charts(
        self,
        slides_content: list,
        topic: str,
        rag_index: list | None,
        user_id: int | None,
        ir_tables_text: str = "",
    ) -> list:
        """Phase 1e – chart creation + merge into slides.

        Reuses RAG evidence already stored on each slide from Phase 1c/1d
        to avoid duplicate retrieve_combined calls.
        """
        print("   → Creating chart specifications...")
        sem = asyncio.Semaphore(self.max_concurrency)

        async def _build_chart(slide: Dict[str, Any]) -> Dict[str, Any] | None:
            if not self._should_have_chart(slide):
                return None
            async with sem:
                # Reuse RAG evidence already attached during research phase
                rag_evidence_str = slide.get('_rag_evidence', '')
                research_chart_data = slide.get('_research_chart_data')
                slide_num = slide.get('slide_number', 0)
                try:
                    chart_result = await self.chart_creator.execute({
                        'slide': slide,
                        'rag_evidence': rag_evidence_str,
                        'research_chart_data': research_chart_data,
                        'plan_constraints': slide.get('_plan_constraints') or {},
                        'ir_tables': ir_tables_text,
                        'design_guidelines': self.design_guidelines,
                    })
                    chart_spec = None
                    if isinstance(chart_result, dict):
                        if chart_result.get("chart_created") is False:
                            chart_spec = self.chart_creator.get_fallback_response("chart_created_false")
                        elif chart_result.get('chart_spec'):
                            chart_spec = chart_result.get('chart_spec')
                        elif chart_result.get('chart_type'):
                            chart_spec = chart_result
                        else:
                            print(f"⚠️  Chart creation returned invalid structure for slide {slide_num}")
                    if chart_spec and isinstance(chart_spec, dict):
                        self._log_agent_execution("ChartCreator", slide_num, True, chart_spec.get("chart_type", "chart"))
                        return {
                            'slide_number': slide_num,
                            'chart_spec': chart_spec,
                        }
                    self._log_agent_execution("ChartCreator", slide_num, False, "No chart spec")
                    return None
                except Exception as exc:
                    self._log_agent_execution("ChartCreator", slide_num, False, str(exc))
                    import traceback
                    traceback.print_exc()
                    return None

        charts = [c for c in await asyncio.gather(*[_build_chart(s) for s in slides_content]) if c]

        # Merge charts back into slides
        for slide in slides_content:
            chart = next(
                (c for c in charts if c['slide_number'] == slide['slide_number']),
                None,
            )
            if chart:
                slide['chart'] = chart

        print(f"   ✓ Generated {len(slides_content)} slides")
        return slides_content

    async def _redo_layouts_for_indices(
        self,
        plan: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        indices: List[int],
        topic: str,
    ) -> List[Dict[str, Any]]:
        """Re-decide layouts for selected slides, preserving global diversity."""
        if not indices:
            return layouts

        layout_counts: Dict[str, int] = {}
        for layout in layouts:
            layout_type = layout.get("layout_type", "single_column_text")
            layout_counts[layout_type] = layout_counts.get(layout_type, 0) + 1

        layout_by_slide = self._build_layout_by_slide(layouts)

        for idx in indices:
            if idx < 0 or idx >= len(plan.get("slides", [])):
                continue
            slide_plan = plan["slides"][idx]
            slide_number = self._coerce_slide_number(slide_plan.get("slide_number")) or (idx + 1)
            slide_stub = {
                "slide_number": slide_number,
                "title": slide_plan.get("title", ""),
                "content_type": slide_plan.get("content_type", "text"),
                "content": slide_plan.get("key_points", []),
                "constraints": slide_plan.get("constraints", {}),
                "visual_intent": slide_plan.get("visual_intent", False),
                "chart": None,
            }
            context = {
                "total_slides": len(plan.get("slides", [])),
                "slide_position": slide_number / max(len(plan.get("slides", [])), 1),
                "has_chart": False,
                "num_content_items": len(slide_stub.get("content", [])),
                "design_guidelines": self.design_guidelines,
            }
            new_layout = await self.layout_agent.decide_layout(slide_stub, context)
            if "slide_number" not in new_layout:
                new_layout["slide_number"] = slide_number
            if slide_number == 1 or slide_plan.get("content_type") == "title":
                new_layout["layout_type"] = "title_cover"
                new_layout["element_positions"] = self.layout_agent._get_default_positions("title_cover")
            else:
                new_layout = self._apply_layout_rules(slide_stub, new_layout)
                new_layout = self._enforce_layout_diversity(new_layout, slide_stub, context, layout_counts)

            layout_by_slide[slide_number] = new_layout

        # Rebuild layouts in original order
        rebuilt = []
        for idx, slide_plan in enumerate(plan.get("slides", [])):
            slide_number = self._coerce_slide_number(slide_plan.get("slide_number")) or (idx + 1)
            if slide_number in layout_by_slide:
                rebuilt.append(layout_by_slide[slide_number])
        return rebuilt

    async def _regenerate_content_for_indices(
        self,
        plan: Dict[str, Any],
        research_results: list,
        layouts: List[Dict[str, Any]],
        tone: str,
        topic: str,
        rag_index: list | None,
        user_id: int | None,
        ir_tables_text: str,
        content_structure: Dict[str, Any],
        indices: List[int],
    ) -> Dict[str, Any]:
        """Re-run content writer for selected slides only."""
        if not indices:
            return content_structure
        layout_by_slide = self._build_layout_by_slide(layouts)
        all_slides = plan.get("slides", [])

        for idx in indices:
            if idx < 0 or idx >= len(all_slides):
                continue
            slide_plan = all_slides[idx]
            research = research_results[idx] if idx < len(research_results) else {}
            rag_evidence_str = research.get("_rag_evidence", "") if isinstance(research, dict) else ""
            research_chart_data = research.get("chart_data") if isinstance(research, dict) else None

            slide_num = self._coerce_slide_number(slide_plan.get("slide_number")) or (idx + 1)
            layout = layout_by_slide.get(slide_num, {})
            layout_type = layout.get("layout_type", "single_column_text")
            constraints = self._get_layout_constraints(layout_type)
            has_illustration = (
                slide_plan.get("visual_intent", False)
                and layout_type not in NO_ILLUSTRATION_LAYOUTS
            )
            prev_title = all_slides[idx - 1].get("title", "") if idx > 0 else ""
            next_title = all_slides[idx + 1].get("title", "") if idx < len(all_slides) - 1 else ""

            rewritten = await self.content_writer.execute({
                "plan": slide_plan,
                "research": research,
                "instruction": slide_plan.get("instruction", ""),
                "tone": tone,
                "constraints": constraints,
                "plan_constraints": slide_plan.get("constraints", {}),
                "has_illustration": has_illustration,
                "rag_evidence": rag_evidence_str,
                "ir_tables": ir_tables_text,
                "design_guidelines": self.design_guidelines,
                "prev_title": prev_title,
                "next_title": next_title,
            })
            if isinstance(rewritten, dict) and rag_evidence_str:
                rewritten["_rag_evidence"] = rag_evidence_str
            if isinstance(rewritten, dict) and research_chart_data:
                rewritten["_research_chart_data"] = research_chart_data
            if isinstance(rewritten, dict):
                rewritten["_plan_constraints"] = slide_plan.get("constraints", {})
                rewritten["visual_intent"] = slide_plan.get("visual_intent", False)
                rewritten["visual_intensity"] = slide_plan.get("visual_intensity", "low")
                rewritten["visual_composition"] = slide_plan.get("visual_composition", {})

            # Preserve existing chart/illustration unless regenerated elsewhere
            existing = content_structure.get("slides", [])[idx]
            if isinstance(existing, dict):
                if "chart" in existing and "chart" not in rewritten:
                    rewritten["chart"] = existing["chart"]
                if "illustration" in existing and "illustration" not in rewritten:
                    rewritten["illustration"] = existing["illustration"]

            content_structure["slides"][idx] = rewritten

        return content_structure

    async def _regenerate_charts_for_indices(
        self,
        content_structure: Dict[str, Any],
        indices: List[int],
        topic: str,
        rag_index: list | None,
        user_id: int | None,
        ir_tables_text: str,
    ) -> Dict[str, Any]:
        """Re-run chart creator for selected slides only."""
        if not indices:
            return content_structure

        for idx in indices:
            if idx < 0 or idx >= len(content_structure.get("slides", [])):
                continue
            slide = content_structure["slides"][idx]
            if not self._should_have_chart(slide):
                continue
            rag_evidence_str = slide.get("_rag_evidence", "")
            research_chart_data = slide.get("_research_chart_data")
            chart = await self.chart_creator.execute({
                "slide": slide,
                "rag_evidence": rag_evidence_str,
                "research_chart_data": research_chart_data,
                "plan_constraints": slide.get("_plan_constraints") or {},
                "ir_tables": ir_tables_text,
                "design_guidelines": self.design_guidelines,
            })
            if isinstance(chart, dict) and chart.get("chart_created") is False:
                chart = self.chart_creator.get_fallback_response("chart_created_false")
            if chart:
                slide["chart"] = {"chart_spec": chart}
        return content_structure
    
    async def _decide_layouts(
        self,
        content_structure: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        AI decides optimal layout for each slide
        """
        
        slides = content_structure['slides']
        layouts = []
        
        print(f"   → AI analyzing {len(slides)} slides for optimal layouts...")
        
        layout_counts = {}

        for slide in slides:
            # Context for layout decision
            context = {
                'total_slides': len(slides),
                'slide_position': slide['slide_number'] / len(slides),
                'has_chart': 'chart' in slide,
                'num_content_items': len(slide.get('content', [])),
                'design_guidelines': self.design_guidelines
            }
            
            # AI decides layout
            layout = await self.layout_agent.decide_layout(slide, context)
            if "slide_number" not in layout:
                layout["slide_number"] = slide.get("slide_number")
            if slide.get('slide_number') == 1 or slide.get('content_type') == 'title':
                layout['layout_type'] = 'title_cover'
                layout['element_positions'] = self.layout_agent._get_default_positions('title_cover')
                layouts.append(layout)
                layout_counts.setdefault('title_cover', 0)
                layout_counts['title_cover'] += 1
                layout_type = layout.get('layout_type', 'unknown')
                print(f"      Slide {slide['slide_number']}: {layout_type}")
                continue
            layout = self._apply_layout_rules(slide, layout)
            layout = self._enforce_layout_diversity(layout, slide, context, layout_counts)
            layouts.append(layout)
            
            layout_type = layout.get('layout_type', 'unknown')
            print(f"      Slide {slide['slide_number']}: {layout_type}")
        
        print(f"   ✓ Decided layouts for all slides")
        
        return layouts

    def _enforce_prompt_requirements(
        self,
        topic: str,
        content_structure: Dict[str, Any],
        allow_charts: bool = True,
    ) -> Dict[str, Any]:
        """Hard-enforce requirements explicitly stated in the prompt."""
        slides = content_structure.get("slides", [])
        if not slides:
            return content_structure

        import re
        topic_lower = (topic or "").lower()

        def pick_slide(match_keywords, fallback_index=1):
            for slide in slides:
                title = str(slide.get("title", "")).lower()
                if any(k in title for k in match_keywords):
                    return slide
            return slides[fallback_index] if len(slides) > fallback_index else slides[0]

        def rewrite_instruction(slide: Dict[str, Any], new_type: str, reason: str = "") -> None:
            base = str(slide.get("instruction", "") or "").strip()
            prefix = f"PRIMARY REQUIREMENT: content_type is '{new_type}'. "
            extra = ""
            if new_type == "chart":
                extra = "Ensure numeric data supports a chart and include a clear insight headline."
            elif new_type == "concentric_circles":
                extra = "Provide TAM/SAM/SOM labels with values and a short explanation."
            elif new_type == "table":
                extra = "Provide structured rows/columns suitable for a table."
            elif new_type in {"timeline", "milestone"}:
                extra = "Provide 3-5 milestones with dates/phases."
            elif new_type == "comparison":
                extra = "Provide distinct left/right items and a concise comparison axis."
            elif new_type == "pestel":
                extra = "Provide concise items for all PESTEL categories."
            elif new_type == "swot":
                extra = "Provide concise SWOT points across all four buckets."
            if reason:
                extra = f"{extra} (Reason: {reason})".strip()
            if base:
                slide["instruction"] = f"{prefix}{extra} Original intent: {base}".strip()
            else:
                slide["instruction"] = f"{prefix}{extra}".strip()

        def mark_min_count(content_type, count, exclude_types=None):
            exclude_types = exclude_types or set()
            # First, count slides already assigned this content_type
            already = sum(1 for s in slides if s.get("content_type") == content_type)
            needed = count - already
            if needed <= 0:
                return

            # Prefer data-oriented slides (by title keyword) over arbitrary ones
            data_keywords = {
                "market", "revenue", "growth", "trend", "sales", "metric",
                "data", "performance", "rate", "share", "adoption", "size",
                "cagr", "roi", "profit", "cost", "budget", "forecast",
                "statistic", "kpi", "comparison", "benchmark", "analysis",
            }
            skip_types = {"title", "thanks", "conclusion"} | exclude_types

            def _score(s):
                if s.get("slide_number") == 1 or s.get("content_type") in skip_types:
                    return -1
                if s.get("content_type") == content_type:
                    return -1  # already a chart
                title = str(s.get("title", "")).lower()
                hits = sum(1 for kw in data_keywords if kw in title)
                return hits

            ranked = sorted(slides, key=_score, reverse=True)
            selected = 0
            for slide in ranked:
                if _score(slide) < 0:
                    continue
                prev_type = slide.get("content_type")
                slide["content_type"] = content_type
                if prev_type != content_type:
                    rewrite_instruction(slide, content_type, reason="min_count_enforced")
                selected += 1
                if selected >= needed:
                    break

        # TAM/SAM/SOM concentric circles
        if all(k in topic_lower for k in ("tam", "sam", "som")) or "concentric" in topic_lower:
            target = pick_slide(("market", "tam", "sam", "som", "opportunity"))
            prev_type = target.get("content_type")
            target["content_type"] = "concentric_circles"
            target["title"] = target.get("title") or "Market Size (TAM/SAM/SOM)"
            target["key_points"] = [
                "TAM: Total Addressable Market",
                "SAM: Serviceable Available Market",
                "SOM: Serviceable Obtainable Market"
            ]
            if prev_type != "concentric_circles":
                rewrite_instruction(target, "concentric_circles", reason="prompt_requirement")

        # SWOT / PESTEL / timeline / table / cycle / funnel / pyramid / comparison
        if "swot" in topic_lower:
            target = pick_slide(("swot", "strength", "weakness"))
            prev_type = target.get("content_type")
            target.update({"content_type": "swot"})
            if prev_type != "swot":
                rewrite_instruction(target, "swot", reason="prompt_requirement")
        if "pestel" in topic_lower or "pestle" in topic_lower:
            target = pick_slide(("pestel", "pestle", "political", "economic"))
            prev_type = target.get("content_type")
            target.update({"content_type": "pestel"})
            if prev_type != "pestel":
                rewrite_instruction(target, "pestel", reason="prompt_requirement")
        if "timeline" in topic_lower or "roadmap" in topic_lower or "milestone" in topic_lower:
            target = pick_slide(("timeline", "roadmap", "milestone"))
            prev_type = target.get("content_type")
            target.update({"content_type": "timeline"})
            if prev_type != "timeline":
                rewrite_instruction(target, "timeline", reason="prompt_requirement")
        if "table" in topic_lower or "checklist" in topic_lower:
            target = pick_slide(("table", "checklist", "compliance"))
            prev_type = target.get("content_type")
            target.update({"content_type": "table"})
            if prev_type != "table":
                rewrite_instruction(target, "table", reason="prompt_requirement")
        if "cycle" in topic_lower or "loop" in topic_lower:
            target = pick_slide(("cycle", "loop", "lifecycle"))
            prev_type = target.get("content_type")
            target.update({"content_type": "cycle"})
            if prev_type != "cycle":
                rewrite_instruction(target, "cycle", reason="prompt_requirement")
        if "funnel" in topic_lower:
            target = pick_slide(("funnel", "conversion"))
            prev_type = target.get("content_type")
            target.update({"content_type": "funnel"})
            if prev_type != "funnel":
                rewrite_instruction(target, "funnel", reason="prompt_requirement")
        if "pyramid" in topic_lower:
            target = pick_slide(("pyramid", "hierarchy"))
            prev_type = target.get("content_type")
            target.update({"content_type": "pyramid"})
            if prev_type != "pyramid":
                rewrite_instruction(target, "pyramid", reason="prompt_requirement")
        if "comparison" in topic_lower or "vs" in topic_lower:
            target = pick_slide(("comparison", "vs", "versus"))
            prev_type = target.get("content_type")
            target.update({"content_type": "comparison"})
            if prev_type != "comparison":
                rewrite_instruction(target, "comparison", reason="prompt_requirement")

        if allow_charts:
            # Minimum charts requirement (e.g., "3 charts")
            chart_count = 0
            match = re.search(r"(\d+)\s+chart", topic_lower)
            if match:
                chart_count = max(1, int(match.group(1)))
            if chart_count == 0 and any(k in topic_lower for k in ("chart", "charts", "graph", "graphs", "bar", "bars", "visualization")):
                # Default to a reasonable minimum if charts/graphs are explicitly requested
                chart_count = max(2, min(4, len(slides) // 3 or 2))

            # CHART_MIN_DENSITY: fraction of non-title/conclusion slides that must be charts
            # e.g. CHART_MIN_DENSITY=0.5 → half the body slides become charts
            density = os.getenv("CHART_MIN_DENSITY", "")
            if density:
                try:
                    ratio = float(density)
                    body_slides = [s for s in slides if s.get("content_type") not in {"title", "thanks", "conclusion"}]
                    density_count = max(1, round(len(body_slides) * ratio))
                    chart_count = max(chart_count, density_count)
                except ValueError:
                    pass

            if chart_count:
                mark_min_count("chart", chart_count, exclude_types={"table", "concentric_circles"})

        return content_structure

    def _enforce_plan_contract(
        self,
        plan: Dict[str, Any],
        slides_content: List[Dict[str, Any]],
        allow_charts: bool = True,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Ensure slide outputs honor planner intent (soft auto-fix, no blocking)."""
        plan_by_num = {s.get("slide_number"): s for s in plan.get("slides", [])}
        violations: List[Dict[str, Any]] = []
        hard_issues = {
            i.strip() for i in os.getenv("HARD_CONSTRAINTS", "").split(",") if i.strip()
        }
        source_map = {
            "content_type_mismatch": "content_writer",
            "missing_required_chart": "chart_creator",
            "chart_removed_for_non_chart_slide": "enforcer",
            "chart_type_not_allowed": "chart_creator",
            "unsupported_chart": "chart_creator",
            "missing_required_labels": "content_writer",
            "numeric_required_missing": "content_writer",
            "missing_required_field": "content_writer",
            "conflicting_constraints": "planner",
            "comparison_rebalanced": "enforcer",
        }

        def record(issue: str, slide_num: int, action: str = "warn", **extra) -> None:
            entry = {
                "slide_number": slide_num,
                "issue": issue,
                "action": action,
                "source": source_map.get(issue, "unknown"),
            }
            if extra:
                entry.update(extra)
            violations.append(entry)
            if issue in hard_issues:
                entry["action"] = "hard_fail"
                raise ValueError(f"Hard constraint violated: {issue} (slide {slide_num})")

        def default_chart_spec() -> Dict[str, Any]:
            return {
                "chart_type": "bar",
                "title": "Key Metric Trend",
                "data": [100, 150, 200, 250, 300],
                "labels": ["2020", "2021", "2022", "2023", "2024"],
                "colors": ["#1E2761", "#CADCFC", "#F96167", "#84B59F", "#B85042"],
                "axes_labels": {"x": "Year", "y": "Value"},
                "insight": "Directional growth over time",
            }
        for slide in slides_content:
            num = slide.get("slide_number")
            planned = plan_by_num.get(num)
            if not planned:
                continue
            constraints = planned.get("constraints") or {}
            planned_type = constraints.get("content_type") or planned.get("content_type")
            if planned_type and slide.get("content_type") != planned_type:
                record(
                    "content_type_mismatch",
                    num,
                    action="auto_fix",
                    planned=planned_type,
                    actual=slide.get("content_type"),
                )
                slide["content_type"] = planned_type

            if not allow_charts:
                slide.pop("chart", None)
            must_render_chart = bool(constraints.get("must_render_chart")) if allow_charts else False
            allowed_chart_types = (constraints.get("allowed_chart_types") or []) if allow_charts else []
            required_labels = constraints.get("required_labels") or []
            numeric_required = bool(constraints.get("numeric_required"))

            if planned_type and planned_type != "chart" and must_render_chart:
                record(
                    "conflicting_constraints",
                    num,
                    action="auto_fix",
                    detail="must_render_chart true for non-chart content_type",
                )
                must_render_chart = False

            if allow_charts:
                if must_render_chart and not slide.get("chart"):
                    record("missing_required_chart", num, action="auto_fix")
                    slide["chart"] = {"slide_number": num, "chart_spec": default_chart_spec()}

                # Remove charts for non-chart planned types to avoid conflicts
                if planned_type and planned_type != "chart" and slide.get("chart"):
                    record(
                        "chart_removed_for_non_chart_slide",
                        num,
                        action="auto_fix",
                        planned=planned_type,
                    )
                    slide.pop("chart", None)

                chart = slide.get("chart")
                if chart:
                    spec = chart.get("chart_spec", {}) if isinstance(chart, dict) else {}
                    if isinstance(spec, dict) and spec.get("status") == "UNSUPPORTED":
                        record("unsupported_chart", num, action="auto_fix", reason=spec.get("reason", ""))
                        if must_render_chart:
                            slide["chart"] = {"slide_number": num, "chart_spec": default_chart_spec()}
                        else:
                            slide.pop("chart", None)
                        spec = None
                    if spec and allowed_chart_types:
                        chart_type = spec.get("chart_type")
                        if chart_type not in allowed_chart_types:
                            record(
                                "chart_type_not_allowed",
                                num,
                                action="auto_fix",
                                actual=chart_type,
                                allowed=allowed_chart_types,
                            )
                            if isinstance(spec, dict):
                                spec["chart_type"] = allowed_chart_types[0]
                                chart["chart_spec"] = spec
                                slide["chart"] = chart

            if required_labels:
                content_text = " ".join(str(c) for c in slide.get("content", []))
                missing_labels = [lbl for lbl in required_labels if lbl.lower() not in content_text.lower()]
                if missing_labels:
                    record(
                        "missing_required_labels",
                        num,
                        action="warn",
                        missing=missing_labels,
                    )

            if numeric_required:
                content_text = " ".join(str(c) for c in slide.get("content", []))
                has_numbers = any(ch.isdigit() for ch in content_text)
                if not has_numbers and slide.get("chart"):
                    spec = slide.get("chart", {}).get("chart_spec", {})
                    data = spec.get("data", [])
                    labels = spec.get("labels", [])
                    has_numbers = bool(data) or any(any(ch.isdigit() for ch in str(l)) for l in labels)
                if not has_numbers:
                    record("numeric_required_missing", num, action="warn")

            if planned_type == "comparison":
                left_items = [str(i).strip() for i in (slide.get("left_items") or []) if str(i).strip()]
                right_items = [str(i).strip() for i in (slide.get("right_items") or []) if str(i).strip()]
                if constraints.get("left_label") and not slide.get("left_label"):
                    slide["left_label"] = constraints.get("left_label")
                if constraints.get("right_label") and not slide.get("right_label"):
                    slide["right_label"] = constraints.get("right_label")
                if constraints.get("comparison_axis") and not slide.get("comparison_axis"):
                    slide["comparison_axis"] = constraints.get("comparison_axis")

                needs_rebalance = False
                reason = ""
                if not left_items or not right_items:
                    needs_rebalance = True
                    reason = "missing_buckets"
                elif self._comparison_items_too_similar(left_items, right_items):
                    needs_rebalance = True
                    reason = "similar_buckets"

                if needs_rebalance:
                    combined: List[str] = []
                    if left_items or right_items:
                        combined = left_items + right_items
                    elif slide.get("content"):
                        combined = [str(i).strip() for i in slide.get("content", []) if str(i).strip()]
                    elif planned.get("key_points"):
                        combined = [str(i).strip() for i in planned.get("key_points", []) if str(i).strip()]
                    if combined:
                        new_left, new_right = self._rebalance_comparison_items(combined)
                        if new_left and new_right:
                            record("comparison_rebalanced", num, action="auto_fix", reason=reason)
                            slide["left_items"] = new_left
                            slide["right_items"] = new_right
                            slide["content"] = list(new_left) + list(new_right)

            required_fields = constraints.get("required_fields") or []
            for field in required_fields:
                if field == "chart":
                    continue
                value = slide.get(field)
                if value in (None, "", [], {}):
                    record("missing_required_field", num, action="warn", field=field)

            if planned_type == "concentric_circles":
                slide.pop("headline_insight", None)

        return slides_content, violations

    async def _fit_content_to_layouts(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        tone: str
    ) -> Dict[str, Any]:
        """Rewrite slide content to fit layout-specific constraints."""
        slides = content_structure['slides']
        updated_slides = []
        topic = content_structure.get('topic', '')

        for slide, layout in zip(slides, layouts):
            constraints = self._get_layout_constraints(layout.get('layout_type', 'single_column_text'))
            if self._needs_rewrite(slide, constraints):
                rewritten = await self._rewrite_slide_to_fit(slide, constraints, tone)
                updated_slides.append(rewritten)
            else:
                updated_slides.append(slide)
        
        # Ensure framework slides are populated
        for slide in updated_slides:
            if slide.get('content_type') == 'pestel':
                slide['content'] = await self._fill_pestel_items_with_llm(
                    slide.get('content', []), topic
                )

        content_structure['slides'] = updated_slides
        return content_structure

    @staticmethod
    def _default_pestel_items(topic: str) -> List[str]:
        topic_hint = topic.strip() if topic else "the business"
        return [
            f"Policy and government priorities affecting {topic_hint}",
            "Market growth, pricing pressure, and funding conditions",
            "Trust, adoption, and stakeholder expectations",
            "Platform evolution, AI capability, and integration trends",
            "Energy use, sustainability demands, and ESG scrutiny",
            "Regulatory compliance, liability, and data protection",
        ]

    async def _fill_pestel_items_with_llm(self, items: List[str], topic: str) -> List[str]:
        """Ensure PESTEL has 6 concise items, using LLM when content is missing."""
        normalized = [str(i).strip() for i in items if str(i).strip()]
        if len(normalized) >= 6:
            return normalized[:6]

        system_prompt = "Return only valid JSON."
        user_prompt = f"""You are completing a PESTEL slide with concise, investor-ready points.
Topic: {topic or "the business"}

Return JSON in this exact format:
{{"items":["Political...","Economic...","Social...","Technological...","Environmental...","Legal..."]}}

Rules:
- Exactly 6 items, in PESTEL order (P, E, S, T, E, L)
- Each item 8-14 words
- Concrete, business-relevant wording — not textbook definitions
- Match the deck's professional tone: each item should feel like an investor-ready bullet
- If some items already exist, keep their meaning but polish for concision

Existing items:
{normalized}
"""
        try:
            response = await self.llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=400,
                response_format="json"
            )
            items_out = response.get("items", []) if isinstance(response, dict) else []
            cleaned = [str(i).strip() for i in items_out if str(i).strip()]
            if len(cleaned) >= 6:
                return cleaned[:6]
        except Exception:
            pass

        defaults = self._default_pestel_items(topic)
        while len(normalized) < 6:
            normalized.append(defaults[len(normalized)])
        return normalized[:6]

    async def _illustration_enrichment(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]]
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Generate and attach illustrations with layout-aware placement."""
        slides = content_structure['slides']
        layout_by_slide = self._build_layout_by_slide(layouts)

        sem = asyncio.Semaphore(self.max_concurrency)

        async def _build_illustration(slide: Dict[str, Any], idx: int) -> Dict[str, Any] | None:
            slide_number = self._coerce_slide_number(slide.get("slide_number")) or (idx + 1)
            layout = layout_by_slide.get(slide_number, {})
            layout_type = layout.get("layout_type", "single_column_text")

            if layout_type in ILLUSTRATION_VARIANT_LAYOUTS:
                # Variant layouts have native illustration zones — always allowed
                illust_pos = layout.get("element_positions", {}).get("illustration")
                if not illust_pos:
                    return None
                style_hint = self._illustration_style_hint(layout_type, slide)
                slot_w = illust_pos.get("w", 2.0)
                slot_h = illust_pos.get("h", 1.6)
                aspect_hint = self._aspect_hint_from_slot(slot_w, slot_h)
                async with sem:
                    illustration = await self.image_agent.generate_illustration({
                        "title": slide.get("title", ""),
                        "items": slide.get("content", []),
                        "layout_type": layout_type,
                        "style_hint": style_hint,
                        "aspect_hint": aspect_hint,
                    })
                if not illustration.get("path"):
                    return None
                return {
                    "slide_number": slide_number,
                    "layout_type": layout_type,
                    "position": illust_pos,
                    "style_hint": style_hint,
                    "prompt": illustration.get("prompt"),
                    "path": illustration.get("path"),
                }

            if not self._needs_illustration(slide, layout_type):
                return None

            style_hint = self._illustration_style_hint(layout_type, slide)
            slot = await self._choose_illustration_slot(slide, layout_type, layout)
            position = slot.get("position") if slot else None
            if not position:
                return None

            aspect_hint = self._aspect_hint_from_slot(
                position.get("w", 2.0), position.get("h", 1.6)
            )
            async with sem:
                illustration = await self.image_agent.generate_illustration({
                    "title": slide.get("title", ""),
                    "items": slide.get("content", []),
                    "layout_type": layout_type,
                    "style_hint": style_hint,
                    "aspect_hint": aspect_hint,
                })
            if not illustration.get("path"):
                return None
            return {
                "slide_number": slide_number,
                "layout_type": layout_type,
                "position": position,
                "style_hint": style_hint,
                "prompt": illustration.get("prompt"),
                "path": illustration.get("path"),
            }

        results = [
            r for r in await asyncio.gather(*[_build_illustration(s, idx) for idx, s in enumerate(slides)])
            if r
        ]
        by_slide = {r["slide_number"]: r for r in results}

        for slide in slides:
            r = by_slide.get(slide.get("slide_number"))
            if not r:
                continue
            slide["illustration"] = {
                "path": r["path"],
                "prompt": r.get("prompt"),
                "style": r.get("style_hint"),
                "position": r["position"],
            }
            layout_type = r.get("layout_type", "single_column_text")
            position = r.get("position", {})
            if slide.get("content"):
                constraints = self._get_layout_constraints(layout_type)
                max_bullets = constraints.get("max_bullets", 5)
                illust_area = position.get("w", 0) * position.get("h", 0)
                if illust_area > 3.0:
                    reduced = max(2, max_bullets - 2)
                elif illust_area > 1.5:
                    reduced = max(2, max_bullets - 1)
                else:
                    reduced = max_bullets
                slide["content"] = slide["content"][:reduced]

        return content_structure, layouts

    @staticmethod
    def _aspect_hint_from_slot(w: float, h: float) -> str:
        """Derive aspect ratio hint from slot dimensions."""
        if h == 0:
            return "square"
        ratio = w / h
        if ratio > 1.3:
            return "landscape, wider than tall"
        if ratio < 0.77:
            return "portrait, taller than wide"
        return "square"

    def _needs_illustration(self, slide: Dict[str, Any], layout_type: str) -> bool:
        """Decide whether a slide should receive an illustration overlay."""
        if layout_type in NO_ILLUSTRATION_LAYOUTS:
            return False
        if layout_type not in ILLUSTRATION_LAYOUT_WHITELIST:
            return False

        content_type = slide.get("content_type", "text")
        # IR content types that are purely analytical – no illustration
        no_illustration_content = {
            "table", "concentric_circles", "swot", "pestel",
            "cycle", "thanks", "title",
        }
        if content_type in no_illustration_content:
            return False

        # Chart slides should not receive illustrations
        if content_type == "chart":
            return False

        # Keyword heuristic for IR-relevant topics
        keywords = [
            "market", "opportunity", "strategy", "risk", "compliance",
            "security", "safety", "barrier", "entry", "roadmap",
            "milestone", "growth", "scale", "go-to-market",
            "product", "platform", "technology", "team",
        ]
        title = str(slide.get("title", "")).lower()
        content = " ".join(str(c).lower() for c in slide.get("content", []))
        return any(k in title or k in content for k in keywords)

    # --- Style hints per layout type -------------------------------------------

    _STYLE_HINTS: Dict[str, str] = {
        "comparison": "split contrast illustration (before/after or risk vs control)",
        "split_comparison": "split contrast illustration (before/after or risk vs control)",
        "comparison_with_center_visual": "bridging concept illustration between two sides",
        "timeline": "process or roadmap illustration with 3-5 stages",
        "timeline_horizontal": "linear progression illustration",
        "timeline_with_backdrop": "contextual roadmap backdrop illustration",
        "milestone": "achievement or milestone icon cluster",
        "steps": "sequential process mini-illustration",
        "chart": "micro-illustration icon near title (small icon cluster)",
        "full_chart": "micro-illustration icon near title (small icon cluster)",
        "two_column_text_chart": "micro-illustration icon near title (small icon cluster)",
        "text_chart_micro_illustration": "micro-illustration icon near title",
        "single_column_text": "headline illustration conveying the main idea",
        "text_left_illustration_right": "large narrative illustration supporting the text",
        "items": "category illustration matching the topic",
        "big_number_stats": "growth or metric visualisation",
        "big_number": "growth or metric visualisation",
        "big_number_with_hero_image": "hero visual metaphor for the key metric",
        "pyramid": "hierarchical structure illustration",
        "funnel": "conversion or filtering illustration",
        "three_column_cards": "small thematic illustration",
        "summary": "key takeaway illustration",
        "quote": "inspirational or contextual illustration",
    }

    def _illustration_style_hint(self, layout_type: str, slide: Dict[str, Any]) -> str:
        return self._STYLE_HINTS.get(
            layout_type, "headline illustration that conveys the main idea"
        )

    # --- Slot selection --------------------------------------------------------

    async def _choose_illustration_slot(
        self,
        slide: Dict[str, Any],
        layout_type: str,
        layout: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Choose the best illustration placement slot for a slide."""
        element_positions = (layout or {}).get("element_positions", {})
        candidates = self._illustration_slots(layout_type, element_positions)
        if not candidates:
            return {}
        choice = await self.image_agent.choose_placement({
            "title": slide.get("title", ""),
            "layout_type": layout_type,
            "candidates": candidates,
        })
        slot_id = choice.get("slot_id")
        for c in candidates:
            if c["id"] == slot_id:
                return c
        return candidates[0]

    def _illustration_slots(
        self,
        layout_type: str,
        element_positions: Dict[str, Dict] | None = None,
    ) -> list[Dict[str, Any]]:
        """Return candidate illustration slots for a layout type.

        Uses a two-stage approach:
        1. Try computing safe whitespace zones from actual element_positions.
        2. Fall back to an expanded per-layout hardcoded mapping.
        """
        if layout_type in NO_ILLUSTRATION_LAYOUTS:
            return []

        if element_positions:
            safe_zones = self._compute_safe_zones(layout_type, element_positions)
            if safe_zones:
                return safe_zones

        return self._hardcoded_illustration_slots(layout_type)

    # --- Whitespace-based zone computation ------------------------------------

    @staticmethod
    def _rects_overlap(a: Dict, b: Dict, padding: float = 0.2) -> bool:
        """Check if two rectangles overlap (with padding)."""
        ax1 = a["x"] - padding
        ay1 = a["y"] - padding
        ax2 = a["x"] + a["w"] + padding
        ay2 = a["y"] + a["h"] + padding
        bx1, by1 = b["x"], b["y"]
        bx2 = b["x"] + b["w"]
        by2 = b["y"] + b["h"]
        return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1

    def _compute_safe_zones(
        self,
        layout_type: str,
        element_positions: Dict[str, Dict],
    ) -> list[Dict[str, Any]]:
        """Compute illustration zones from whitespace not occupied by elements.

        Accounts for brand chrome elements that are NOT in element_positions:
        - Top bar: (0, 0, 10, 0.08)
        - Header line: (0.6, 1.2, 8.8, 0.02)
        - Corner accent: (9.2, 0.35, 0.6, 0.12)
        """
        SLIDE_W, SLIDE_H = 10.0, 5.625
        MIN_W, MIN_H = 1.0, 0.8

        occupied = []
        for key, pos in element_positions.items():
            if key == "illustration":
                continue
            if isinstance(pos, dict) and all(k in pos for k in ("x", "y", "w", "h")):
                occupied.append(pos)

        # Add brand chrome as occupied zones
        occupied.extend([
            {"x": 0, "y": 0, "w": 10.0, "h": 0.1},       # top bar
            {"x": 0.6, "y": 1.15, "w": 8.8, "h": 0.1},    # header line
            {"x": 9.0, "y": 0.3, "w": 0.8, "h": 0.2},     # corner accent
        ])

        if not occupied:
            return []

        # Candidate regions — prioritise bottom zones (safest for most layouts)
        candidates = [
            {"id": "bottom_right", "desc": "Bottom-right corner",
             "position": {"x": 7.0, "y": 4.0, "w": 2.2, "h": 1.3}},
            {"id": "bottom_left", "desc": "Bottom-left corner",
             "position": {"x": 0.6, "y": 4.0, "w": 2.2, "h": 1.3}},
            {"id": "bottom_center", "desc": "Bottom-centre area",
             "position": {"x": 3.5, "y": 4.0, "w": 3.0, "h": 1.3}},
            {"id": "right_gutter", "desc": "Right-side gutter",
             "position": {"x": 7.5, "y": 1.5, "w": 2.0, "h": 2.0}},
            {"id": "left_gutter", "desc": "Left-side gutter",
             "position": {"x": 0.6, "y": 1.5, "w": 2.0, "h": 2.0}},
        ]

        safe = []
        for cand in candidates:
            pos = cand["position"]
            if pos["w"] < MIN_W or pos["h"] < MIN_H:
                continue
            # Check within slide bounds
            if pos["x"] + pos["w"] > SLIDE_W - 0.1 or pos["y"] + pos["h"] > SLIDE_H - 0.1:
                continue
            overlaps = any(self._rects_overlap(pos, occ) for occ in occupied)
            if not overlaps:
                safe.append(cand)

        # Sort by area (largest first)
        safe.sort(key=lambda c: c["position"]["w"] * c["position"]["h"], reverse=True)
        return safe[:2]

    # --- Hardcoded fallback slots per layout type -----------------------------

    @staticmethod
    def _hardcoded_illustration_slots(layout_type: str) -> list[Dict[str, Any]]:
        """Per-layout illustration slot mapping (fallback).

        POSITIONING RULES (slide is 10" x 5.625"):
        - Brand chrome: top bar 0-0.08", header line at y=1.2", accent at x=9.2"
        - Title: y≈0.5, h≈0.8 → bottom edge ≈1.3"
        - Safe x range: 0.5–8.8 (avoid accent block at 9.2)
        - Safe y start: ≥1.35 (below chrome header line)
        - Safe y end: ≤5.4 (leave 0.225" bottom margin)
        - Prefer bottom-right or right-panel gutters (eye naturally flows there)
        - Never overlap the main content zone of the layout
        """
        slots = {
            # --- Timeline: line at y≈2.5, labels extend to y≈3.7 ---
            "timeline": [
                {"id": "bottom_center", "desc": "Centered below timeline labels",
                 "position": {"x": 3.4, "y": 4.0, "w": 3.2, "h": 1.3}},
            ],
            "timeline_horizontal": [
                {"id": "bottom_center", "desc": "Centered below timeline",
                 "position": {"x": 3.4, "y": 4.0, "w": 3.2, "h": 1.3}},
            ],
            # --- Milestone: line at y≈2.6, labels extend to y≈3.9 ---
            "milestone": [
                {"id": "bottom_right", "desc": "Bottom-right, below milestones",
                 "position": {"x": 7.2, "y": 4.2, "w": 2.0, "h": 1.1}},
            ],
            # --- Steps: boxes at y≈2.0, h≈1.2, end at y≈3.2 ---
            "steps": [
                {"id": "bottom_center", "desc": "Below the step boxes, centred",
                 "position": {"x": 3.4, "y": 3.6, "w": 3.2, "h": 1.6}},
            ],
            # --- Comparison: panels at y=1.5, h=3.5, end at y=5.0 ---
            "comparison": [
                {"id": "bottom_center", "desc": "Bottom-centre gap between panels",
                 "position": {"x": 4.2, "y": 4.2, "w": 1.6, "h": 1.1}},
            ],
            "split_comparison": [
                {"id": "bottom_center", "desc": "Bottom-centre gap between panels",
                 "position": {"x": 4.2, "y": 4.2, "w": 1.6, "h": 1.1}},
            ],
            # --- Single column text: content at (1.5, 1.8, 7, 3.5) ends at x=8.5, y=5.3 ---
            "single_column_text": [
                {"id": "bottom_right", "desc": "Bottom-right below content",
                 "position": {"x": 7.0, "y": 4.0, "w": 2.2, "h": 1.3}},
                {"id": "bottom_left", "desc": "Bottom-left below content",
                 "position": {"x": 0.6, "y": 4.0, "w": 2.2, "h": 1.3}},
            ],
            # --- Items: content at (1.1, 1.6, 7.8, 3.6) ends at x=8.9, y=5.2 ---
            "items": [
                {"id": "bottom_right", "desc": "Bottom-right below items",
                 "position": {"x": 7.0, "y": 4.0, "w": 2.2, "h": 1.3}},
                {"id": "bottom_left", "desc": "Bottom-left below items",
                 "position": {"x": 0.6, "y": 4.0, "w": 2.2, "h": 1.3}},
            ],
            # --- Three column cards: cards at y=1.5, h=3.0, end at y=4.5 ---
            "three_column_cards": [
                {"id": "bottom_center", "desc": "Below cards, centred",
                 "position": {"x": 3.5, "y": 4.7, "w": 3.0, "h": 0.7}},
            ],
            # --- Title cover: title at y≈1.6, subtitle at y≈3.0 ---
            "title_cover": [
                {"id": "right_hero", "desc": "Right-side hero area",
                 "position": {"x": 5.8, "y": 1.4, "w": 3.4, "h": 3.2}},
                {"id": "bottom_center", "desc": "Bottom-centre below subtitle",
                 "position": {"x": 2.5, "y": 3.8, "w": 5.0, "h": 1.4}},
            ],
            # --- Summary: two columns at y=1.8, h=3.2, end at y=5.0 ---
            "summary": [
                {"id": "bottom_center", "desc": "Bottom-centre below summary",
                 "position": {"x": 3.5, "y": 4.2, "w": 3.0, "h": 1.1}},
            ],
            # --- Big number stats: stat boxes y=1.4, h=1.35, end at y≈2.75 ---
            "big_number_stats": [
                {"id": "bottom_center", "desc": "Below stat boxes, centred",
                 "position": {"x": 3.0, "y": 3.0, "w": 4.0, "h": 2.2}},
            ],
            "big_number": [
                {"id": "bottom_center", "desc": "Below stat boxes, centred",
                 "position": {"x": 3.0, "y": 3.0, "w": 4.0, "h": 2.2}},
            ],
            # --- Pyramid: levels y=1.6, h=3.2, centred horizontally ---
            "pyramid": [
                {"id": "right_gutter", "desc": "Right gutter, clear of pyramid",
                 "position": {"x": 8.0, "y": 1.8, "w": 1.4, "h": 2.0}},
            ],
            # --- Funnel: levels y=1.6, h=3.2, centred horizontally ---
            "funnel": [
                {"id": "right_gutter", "desc": "Right gutter, clear of funnel",
                 "position": {"x": 8.0, "y": 1.8, "w": 1.4, "h": 2.0}},
            ],
            # --- Quote: quote box y=1.5, h≈2.2, author at y≈3.8 ---
            "quote": [
                {"id": "bottom_right", "desc": "Bottom-right decorative area",
                 "position": {"x": 7.0, "y": 4.0, "w": 2.0, "h": 1.3}},
            ],
            "process_flow": [
                {"id": "bottom_right", "desc": "Bottom-right below flow",
                 "position": {"x": 7.2, "y": 4.0, "w": 2.0, "h": 1.3}},
            ],
        }

        if layout_type in slots:
            return slots[layout_type]

        # Catch-all default: bottom-right is safest for any layout
        return [
            {"id": "bottom_right", "desc": "Bottom-right corner",
             "position": {"x": 7.0, "y": 4.0, "w": 2.2, "h": 1.3}},
            {"id": "bottom_left", "desc": "Bottom-left corner",
             "position": {"x": 0.6, "y": 4.0, "w": 2.2, "h": 1.3}},
        ]

    async def _deck_level_qa_and_fix(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        tone: str,
        lock_layouts: bool = True,
        allow_charts: bool = True,
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Run deck-level QA and apply structured fixes before rendering."""
        slides = content_structure['slides']
        qa_report = await self.deck_qa_agent.review(
            slides,
            layouts,
            self.design_guidelines,
            lock_layouts=lock_layouts
        )
        fixes = qa_report.get('fixes', []) if isinstance(qa_report, dict) else []
        if not fixes:
            return content_structure, layouts

        layout_by_slide = {}
        for layout in layouts:
            key = layout.get('slide_number')
            if isinstance(key, (int, str)):
                layout_by_slide[int(key)] = layout

        for fix in fixes:
            slide_number = fix.get('slide_number')
            actions = fix.get('actions', [])
            if not slide_number or not actions:
                continue
            slide = next((s for s in slides if s.get('slide_number') == slide_number), None)
            layout = layout_by_slide.get(slide_number) or layout_by_slide.get(int(slide_number)) if isinstance(slide_number, (int, str)) else None
            if not slide or not layout:
                continue

            for action in actions:
                action_type = action.get('type')
                if action_type == 'set_layout':
                    if lock_layouts:
                        continue
                    new_layout = action.get('value')
                    if new_layout:
                        layout['layout_type'] = new_layout
                        layout['element_positions'] = self.layout_agent._get_default_positions(new_layout)
                elif action_type == 'add_chart':
                    if not allow_charts:
                        continue
                    if 'chart' not in slide:
                        chart = await self.chart_creator.execute({'slide': slide, 'rag_evidence': ''})
                        slide['chart'] = {
                            'slide_number': slide.get('slide_number'),
                            'chart_spec': chart
                        }
                        if not lock_layouts:
                            layout_type = 'full_chart' if len(slide.get('content', [])) <= 1 else 'two_column_text_chart'
                            layout['layout_type'] = layout_type
                            layout['element_positions'] = self.layout_agent._get_default_positions(layout_type)
                elif action_type == 'shorten_title':
                    constraints = self._get_layout_constraints(layout.get('layout_type', 'single_column_text'))
                    title = slide.get('title', '')
                    if len(title) > constraints['max_title_chars']:
                        slide['title'] = self._trim_sentence_safe(title, constraints['max_title_chars'])
                elif action_type == 'shorten_bullets':
                    constraints = self._get_layout_constraints(layout.get('layout_type', 'single_column_text'))
                    slide = self._apply_hard_truncation(slide, constraints)
                elif action_type == 'title_only':
                    if lock_layouts:
                        continue
                    layout['layout_type'] = 'title_cover'
                    layout['element_positions'] = self.layout_agent._get_default_positions('title_cover')
                    slide['content'] = []
                    slide.pop('chart', None)

        # Re-fit content after QA adjustments
        content_structure['slides'] = slides
        content_structure = await self._fit_content_to_layouts(content_structure, layouts, tone)
        return content_structure, layouts

    async def _logic_review_and_rewrite(
        self,
        content_structure: Dict[str, Any],
        tone: str,
        layouts: List[Dict[str, Any]] | None = None
    ) -> Dict[str, Any]:
        """Rewrite slide text for logical flow and IR-appropriate coherence."""
        slides = content_structure['slides']
        updated = []
        layout_by_slide = {}
        if layouts:
            for layout in layouts:
                key = layout.get('slide_number')
                if isinstance(key, (int, str)):
                    layout_by_slide[int(key)] = layout

        for slide in slides:
            if slide.get('content_type') in {'title', 'thanks'}:
                updated.append(slide)
                continue

            # Use layout-specific constraints when available
            slide_num = slide.get('slide_number', 1)
            layout = layout_by_slide.get(slide_num, {})
            layout_type = layout.get('layout_type', 'single_column_text')
            constraints = self._get_layout_constraints(layout_type)

            input_data = {
                'plan': {
                    'slide_number': slide_num,
                    'title': slide.get('title', ''),
                    'key_points': slide.get('content', []),
                    'content_type': slide.get('content_type', 'text')
                },
                'research': {},
                'tone': tone,
                'constraints': constraints,
                'plan_constraints': slide.get('_plan_constraints') or {},
                'existing_content': {
                    'title': slide.get('title', ''),
                    'content': slide.get('content', []),
                    'left_items': slide.get('left_items', []),
                    'right_items': slide.get('right_items', []),
                    'left_label': slide.get('left_label', ''),
                    'right_label': slide.get('right_label', ''),
                    'comparison_axis': slide.get('comparison_axis', ''),
                },
                'logic_only': True,
                'design_guidelines': self.design_guidelines
            }

            rewritten = await self.content_writer.execute(input_data)
            rewritten['slide_number'] = slide.get('slide_number', rewritten.get('slide_number', 1))
            rewritten['content_type'] = slide.get('content_type', rewritten.get('content_type', 'text'))
            if 'chart' in slide:
                rewritten['chart'] = slide['chart']
            if 'illustration' in slide:
                rewritten['illustration'] = slide['illustration']
            updated.append(self._apply_hard_truncation(rewritten, constraints))

        content_structure['slides'] = updated
        return content_structure
    async def _polish_deck_language(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        tone: str
    ) -> Dict[str, Any]:
        """Polish language for concision and IR-appropriate vocabulary."""
        slides = content_structure['slides']
        polished = []

        for slide, layout in zip(slides, layouts):
            layout_type = layout.get('layout_type', 'single_column_text')
            if layout_type in {'title_cover', 'title_only', 'thanks'}:
                polished.append(slide)
                continue

            constraints = self._get_layout_constraints(layout_type)
            input_data = {
                'plan': {
                    'slide_number': slide.get('slide_number', 1),
                    'title': slide.get('title', ''),
                    'key_points': slide.get('content', []),
                    'content_type': slide.get('content_type', 'text')
                },
                'research': {},
                'tone': tone,
                'constraints': constraints,
                'plan_constraints': slide.get('_plan_constraints') or {},
                'existing_content': {
                    'title': slide.get('title', ''),
                    'content': slide.get('content', []),
                    'left_items': slide.get('left_items', []),
                    'right_items': slide.get('right_items', []),
                    'left_label': slide.get('left_label', ''),
                    'right_label': slide.get('right_label', ''),
                    'comparison_axis': slide.get('comparison_axis', ''),
                },
                'polish_only': True,
                'design_guidelines': self.design_guidelines
            }

            rewritten = await self.content_writer.execute(input_data)
            rewritten['slide_number'] = slide.get('slide_number', rewritten.get('slide_number', 1))
            rewritten['content_type'] = slide.get('content_type', rewritten.get('content_type', 'text'))
            if 'chart' in slide:
                rewritten['chart'] = slide['chart']
            if 'illustration' in slide:
                rewritten['illustration'] = slide['illustration']
            polished.append(self._apply_hard_truncation(rewritten, constraints))

        content_structure['slides'] = polished
        return content_structure

    def _needs_rewrite(self, slide: Dict[str, Any], constraints: Dict[str, int]) -> bool:
        """Check if slide content exceeds layout constraints."""
        title = slide.get('title', '')
        content_items = slide.get('content', [])
        total_chars = sum(len(str(item)) for item in content_items)

        if len(title) > constraints['max_title_chars']:
            return True
        if len(content_items) > constraints['max_bullets']:
            return True
        if total_chars > constraints['max_total_chars']:
            return True
        if any(len(str(item)) > constraints['max_chars_per_bullet'] for item in content_items):
            return True
        return False

    async def _rewrite_slide_to_fit(
        self,
        slide: Dict[str, Any],
        constraints: Dict[str, int],
        tone: str
    ) -> Dict[str, Any]:
        """Rewrite slide text to fit constraints, with fallback truncation."""
        input_data = {
            'plan': {
                'slide_number': slide.get('slide_number', 1),
                'title': slide.get('title', ''),
                'key_points': slide.get('content', []),
                'content_type': slide.get('content_type', 'text')
            },
            'research': {},
            'tone': tone,
            'constraints': constraints,
            'existing_content': {
                'title': slide.get('title', ''),
                'content': slide.get('content', [])
            }
        }

        rewritten = await self.content_writer.execute(input_data)

        # Preserve slide metadata and chart if present
        rewritten['slide_number'] = slide.get('slide_number', rewritten.get('slide_number', 1))
        rewritten['content_type'] = slide.get('content_type', rewritten.get('content_type', 'text'))
        if 'chart' in slide:
            rewritten['chart'] = slide['chart']
        if 'illustration' in slide:
            rewritten['illustration'] = slide['illustration']

        return self._apply_hard_truncation(rewritten, constraints)

    def _apply_hard_truncation(
        self,
        slide: Dict[str, Any],
        constraints: Dict[str, int]
    ) -> Dict[str, Any]:
        """Ensure slide text fits constraints even if rewriting fails."""
        title = slide.get('title', '')
        if len(title) > constraints['max_title_chars']:
            slide['title'] = self._trim_sentence_safe(title, constraints['max_title_chars'])

        content_items = slide.get('content', [])
        content_items = content_items[:constraints['max_bullets']]
        trimmed = []
        for item in content_items:
            text = str(item)
            if len(text) > constraints['max_chars_per_bullet']:
                text = self._trim_sentence_safe(text, constraints['max_chars_per_bullet'])
            trimmed.append(text)

        # Drop whole bullets from the end if total exceeds limit
        # (prefer dropping a bullet over truncating it mid-sentence)
        total_chars = sum(len(item) for item in trimmed)
        while total_chars > constraints['max_total_chars'] and len(trimmed) > 1:
            trimmed.pop()
            total_chars = sum(len(item) for item in trimmed)
        # If single remaining bullet still exceeds, trim it as a last resort
        if trimmed and total_chars > constraints['max_total_chars']:
            trimmed[-1] = self._trim_sentence_safe(trimmed[-1], constraints['max_total_chars'])

        slide['content'] = trimmed
        return slide

    def _truncate_to_limit(self, text: str, limit: int) -> str:
        """Truncate at a natural boundary. Prefer clause/phrase breaks over mid-word cuts."""
        if limit <= 0:
            return ""
        if len(text) <= limit:
            return text
        # Try to find a clause boundary (comma, dash, colon) within the limit
        snippet = text[:limit]
        for sep in (",", " –", " —", " -", ":"):
            idx = snippet.rfind(sep)
            if idx >= max(15, int(limit * 0.4)):
                return snippet[:idx].rstrip()
        # Fall back to word boundary without "..."
        last_space = snippet.rfind(" ")
        if last_space > 10:
            return snippet[:last_space].rstrip()
        return snippet.rstrip()

    def _trim_sentence_safe(self, text: str, limit: int) -> str:
        """Trim text to a whole sentence under limit; fallback to clause-safe truncation."""
        if limit <= 0:
            return ""
        if len(text) <= limit:
            return text
        snippet = text[:limit]
        # Try sentence boundaries first
        for sep in (".", "!", "?", ";"):
            idx = snippet.rfind(sep)
            if idx >= max(20, int(limit * 0.5)):
                return snippet[: idx + 1].rstrip()
        return self._truncate_to_limit(text, limit)

    def _get_layout_constraints(self, layout_type: str) -> Dict[str, int]:
        """Return layout-specific text constraints."""
        defaults = {
            'max_title_chars': 45,
            'max_bullets': 5,
            'max_chars_per_bullet': 70,
            'max_total_chars': 320
        }

        overrides = {
            'title_only': {'max_title_chars': 55, 'max_bullets': 0, 'max_chars_per_bullet': 0, 'max_total_chars': 0},
            'title_cover': {'max_title_chars': 55, 'max_bullets': 1, 'max_chars_per_bullet': 80, 'max_total_chars': 80},
            'single_column_text': {'max_bullets': 5, 'max_chars_per_bullet': 70, 'max_total_chars': 320},
            'two_column_text_chart': {'max_bullets': 5, 'max_chars_per_bullet': 70, 'max_total_chars': 300},
            'full_chart': {'max_bullets': 1, 'max_chars_per_bullet': 100, 'max_total_chars': 120},
            'three_column_cards': {'max_bullets': 6, 'max_chars_per_bullet': 65, 'max_total_chars': 300},
            'split_comparison': {'max_bullets': 6, 'max_chars_per_bullet': 65, 'max_total_chars': 330},
            'big_number_stats': {'max_bullets': 4, 'max_chars_per_bullet': 55, 'max_total_chars': 220},
            'timeline_horizontal': {'max_bullets': 5, 'max_chars_per_bullet': 55, 'max_total_chars': 260},
            'items': {'max_bullets': 6, 'max_chars_per_bullet': 65, 'max_total_chars': 320},
            'steps': {'max_bullets': 5, 'max_chars_per_bullet': 55, 'max_total_chars': 260},
            'summary': {'max_bullets': 5, 'max_chars_per_bullet': 70, 'max_total_chars': 300},
            'comparison': {'max_bullets': 3, 'max_chars_per_bullet': 75, 'max_total_chars': 210},
            'big_number': {'max_bullets': 5, 'max_chars_per_bullet': 55, 'max_total_chars': 240},
            'milestone': {'max_bullets': 5, 'max_chars_per_bullet': 55, 'max_total_chars': 260},
            'pestel': {'max_bullets': 6, 'max_chars_per_bullet': 50, 'max_total_chars': 280},
            'swot': {'max_bullets': 4, 'max_chars_per_bullet': 50, 'max_total_chars': 200},
            'pyramid': {'max_bullets': 5, 'max_chars_per_bullet': 50, 'max_total_chars': 240},
            'timeline': {'max_bullets': 5, 'max_chars_per_bullet': 55, 'max_total_chars': 260},
            'funnel': {'max_bullets': 5, 'max_chars_per_bullet': 50, 'max_total_chars': 240},
            'quote': {'max_bullets': 1, 'max_chars_per_bullet': 120, 'max_total_chars': 120},
            'cycle': {'max_bullets': 5, 'max_chars_per_bullet': 50, 'max_total_chars': 240},
            'thanks': {'max_bullets': 0, 'max_chars_per_bullet': 0, 'max_total_chars': 0},
            'chart': {'max_bullets': 1, 'max_chars_per_bullet': 90, 'max_total_chars': 120},
            'table': {'max_bullets': 8, 'max_chars_per_bullet': 55, 'max_total_chars': 320},
            'concentric_circles': {'max_bullets': 4, 'max_chars_per_bullet': 45, 'max_total_chars': 180},
            # Illustration-variant layouts (reduced text budgets)
            'text_left_illustration_right': {'max_bullets': 4, 'max_chars_per_bullet': 65, 'max_total_chars': 260},
            'big_number_with_hero_image': {'max_bullets': 2, 'max_chars_per_bullet': 55, 'max_total_chars': 120},
            'timeline_with_backdrop': {'max_bullets': 4, 'max_chars_per_bullet': 50, 'max_total_chars': 200},
            'comparison_with_center_visual': {'max_bullets': 4, 'max_chars_per_bullet': 60, 'max_total_chars': 200},
            'text_chart_micro_illustration': {'max_bullets': 5, 'max_chars_per_bullet': 70, 'max_total_chars': 300},
        }

        if layout_type in overrides:
            result = {**defaults, **overrides[layout_type]}
            return result

        return defaults

    def _enforce_layout_diversity(
        self,
        layout: Dict[str, Any],
        slide: Dict[str, Any],
        context: Dict[str, Any],
        layout_counts: Dict[str, int]
    ) -> Dict[str, Any]:
        """Ensure layout types do not repeat (global max = 1)."""
        layout_type = layout.get('layout_type', 'single_column_text')
        layout_counts.setdefault(layout_type, 0)

        max_uses = 1

        if layout_counts[layout_type] < max_uses:
            layout_counts[layout_type] += 1
            return layout

        candidates = self._rank_layout_candidates(slide, context)
        for candidate in candidates:
            if layout_counts.get(candidate, 0) < 1:
                layout['layout_type'] = candidate
                layout['element_positions'] = self.layout_agent._get_default_positions(candidate)
                layout_counts[candidate] = layout_counts.get(candidate, 0) + 1
                return layout

        # If all candidates exhausted, keep original (last resort)
        return layout

    def _rank_layout_candidates(
        self,
        slide: Dict[str, Any],
        context: Dict[str, Any]
    ) -> List[str]:
        """Rank layout options based on slide content.

        When the slide carries visual_intent=True, illustration-variant
        layouts are injected as secondary candidates so the diversity
        enforcer can fall back to them.
        """
        content_type = slide.get('content_type', 'text')
        has_chart = 'chart' in slide
        num_items = len(slide.get('content', []))
        is_title = slide.get('slide_number', 0) == 1
        visual = slide.get('visual_intent', False)

        if is_title or content_type == 'title':
            return ['title_cover', 'title_only']
        if content_type == 'summary':
            return ['summary', 'big_number_stats', 'single_column_text']
        if content_type == 'quote':
            return ['quote', 'single_column_text']
        if content_type == 'thanks':
            return ['thanks', 'title_cover']
        if content_type == 'pestel':
            return ['pestel', 'items']
        if content_type == 'swot':
            return ['swot', 'items']
        if content_type == 'pyramid':
            return ['pyramid', 'items']
        if content_type == 'funnel':
            return ['funnel', 'items']
        if content_type == 'cycle':
            return ['cycle', 'items']
        if content_type == 'steps':
            return ['steps', 'items']
        if content_type == 'items':
            extras = ['text_left_illustration_right'] if visual else []
            return ['items', 'single_column_text'] + extras
        if content_type == 'big_number':
            extras = ['big_number_with_hero_image'] if visual else []
            return ['big_number', 'big_number_stats'] + extras
        if content_type == 'milestone':
            extras = ['timeline_with_backdrop'] if visual else []
            return ['milestone', 'timeline'] + extras
        if content_type == 'chart':
            return ['chart', 'full_chart']
        if content_type == 'table':
            return ['table', 'items']
        if content_type == 'concentric_circles':
            return ['concentric_circles', 'chart']
        if content_type == 'comparison':
            extras = ['comparison_with_center_visual'] if visual else []
            return ['comparison', 'split_comparison'] + extras
        if content_type == 'timeline':
            extras = ['timeline_with_backdrop'] if visual else []
            return ['timeline', 'timeline_horizontal'] + extras
        if has_chart:
            return ['full_chart', 'two_column_text_chart', 'big_number_stats', 'three_column_cards']
        if content_type == 'conclusion':
            return ['summary', 'big_number_stats', 'single_column_text']
        if num_items >= 5:
            return ['three_column_cards', 'items', 'single_column_text']
        if num_items <= 2:
            extras = ['big_number_with_hero_image'] if visual else []
            return ['big_number_stats', 'single_column_text', 'items'] + extras
        extras = ['text_left_illustration_right'] if visual else []
        return ['single_column_text', 'items', 'three_column_cards'] + extras

    def _apply_layout_rules(self, slide: Dict[str, Any], layout: Dict[str, Any]) -> Dict[str, Any]:
        """Override layout based on keyword-driven rules."""
        def _stringify_item(item: Any) -> str:
            if item is None:
                return ""
            if isinstance(item, dict):
                for key in ("text", "title", "label", "value", "content", "point", "name", "description"):
                    val = item.get(key)
                    if val:
                        return str(val)
                parts: List[str] = []
                for val in item.values():
                    if val is None:
                        continue
                    if isinstance(val, (str, int, float)):
                        parts.append(str(val))
                    elif isinstance(val, list):
                        parts.extend(
                            str(v) for v in val if v is not None and isinstance(v, (str, int, float))
                        )
                return " ".join(parts).strip()
            if isinstance(item, list):
                return " ".join(str(v) for v in item if v is not None)
            return str(item)

        content_raw = slide.get("content", []) or []
        if isinstance(content_raw, list):
            content_items = content_raw
        elif isinstance(content_raw, (str, dict)):
            content_items = [content_raw]
        else:
            content_items = [str(content_raw)]

        content_text = " ".join(
            chunk for chunk in (_stringify_item(item) for item in content_items) if chunk
        )
        text = f"{slide.get('title','')} {content_text}".lower()
        content_type = slide.get('content_type', '').lower()
        has_chart = 'chart' in slide
        has_numbers = any(char.isdigit() for char in text)

        if slide.get('slide_number') == 1 or content_type == 'title':
            return layout

        def set_layout(layout_type: str, drop_chart: bool = False):
            layout['layout_type'] = layout_type
            layout['element_positions'] = self.layout_agent._get_default_positions(layout_type)
            if drop_chart:
                slide.pop('chart', None)

        # Explicit content types
        if content_type == 'chart':
            content_count = len(slide.get('content', []))
            layout_type = 'full_chart' if content_count <= 1 else 'two_column_text_chart'
            set_layout(layout_type, drop_chart=False)
            return layout
        if content_type == 'concentric_circles':
            set_layout('concentric_circles', drop_chart=False)
            return layout
        if content_type in {'swot', 'pestel', 'pyramid', 'funnel', 'quote', 'thanks', 'timeline', 'milestone', 'steps', 'items', 'big_number', 'comparison'}:
            set_layout(content_type, drop_chart=content_type in {'quote', 'thanks'})
            return layout

        # TAM/SAM/SOM
        if any(k in text for k in ('tam', 'sam', 'som', 'tam/sam/som')):
            set_layout('concentric_circles', drop_chart=True)
            return layout

        rules = [
            (['overview', 'about'], 'items'),
            (['mission', 'vision'], 'comparison'),
            (['value proposition', 'usp'], 'three_column_cards'),
            (['problem', 'pain point'], 'comparison'),
            (['solution'], 'steps'),
            (['industry overview'], 'items'),
            (['trend', 'macro', 'tailwind'], 'timeline'),
            (['growth drivers'], 'three_column_cards'),
            (['target customers', 'persona'], 'three_column_cards'),
            (['product', 'platform'], 'steps'),
            (['how it works'], 'steps'),
            (['workflow', 'pipeline'], 'steps'),
            (['features'], 'three_column_cards'),
            (['technology stack'], 'pyramid'),
            (['ai', 'ml', 'data'], 'steps'),
            (['business model'], 'pyramid'),
            (['pricing'], 'table'),
            (['revenue streams'], 'three_column_cards'),
            (['unit economics'], 'chart'),
            (['ltv', 'cac'], 'comparison'),
            (['traction'], 'big_number_stats'),
            (['kpi'], 'big_number_stats'),
            (['mom', 'yoy', 'growth'], 'chart'),
            (['users', 'customers'], 'chart'),
            (['retention', 'churn'], 'chart'),
            (['competition', 'competitors'], 'table'),
            (['competitive landscape'], 'table'),
            (['differentiation'], 'comparison'),
            (['moat', 'defensibility'], 'pyramid'),
            (['barriers to entry'], 'pyramid'),
            (['strategy'], 'three_column_cards'),
            (['go-to-market', 'gtm'], 'funnel'),
            (['sales motion'], 'steps'),
            (['partnerships'], 'items'),
            (['roadmap'], 'timeline'),
            (['milestones'], 'milestone'),
            (['risk', 'risks'], 'comparison'),
            (['regulatory', 'compliance'], 'items'),
            (['legal'], 'items'),
            (['esg'], 'three_column_cards'),
            (['data privacy'], 'items'),
            (['financials'], 'table'),
            (['revenue'], 'chart'),
            (['costs'], 'chart'),
            (['burn rate'], 'chart'),
            (['forecast', 'projection'], 'chart'),
            (['use of funds'], 'chart'),
            (['team'], 'three_column_cards'),
            (['founders'], 'three_column_cards'),
            (['advisors'], 'items'),
            (['experience'], 'timeline'),
            (['investors'], 'items'),
            (['ask'], 'big_number_stats'),
            (['funding round'], 'table'),
            (['valuation'], 'comparison'),
            (['next steps'], 'steps'),
            (['contact'], 'thanks'),
            (['okrs'], 'table'),
            (['benchmark'], 'table'),
            (['scenario'], 'steps'),
            (['sensitivity'], 'chart'),
        ]

        for keywords, target_layout in rules:
            if any(k in text for k in keywords):
                should_drop_chart = (
                    target_layout in {'items', 'comparison', 'steps', 'pyramid', 'funnel', 'timeline', 'milestone', 'cycle'}
                    and has_chart
                    and not has_numbers
                )
                set_layout(target_layout, drop_chart=should_drop_chart)
                break

        # If chart exists, ensure a chart-compatible layout
        if 'chart' in slide and layout.get('layout_type') in {
            'items', 'steps', 'summary', 'comparison', 'pestel', 'swot',
            'pyramid', 'timeline', 'funnel', 'quote', 'cycle', 'thanks',
            'table', 'concentric_circles',
            # Illustration-variant layouts without a chart zone
            'text_left_illustration_right', 'big_number_with_hero_image',
            'timeline_with_backdrop', 'comparison_with_center_visual',
        }:
            content_count = len(slide.get('content', []))
            layout_type = 'full_chart' if content_count <= 1 else 'two_column_text_chart'
            set_layout(layout_type, drop_chart=False)

        return layout

    async def _render_html(
        self,
        content_structure: Dict[str, Any],
        layouts: List[Dict[str, Any]],
        template_style: str | Dict[str, Any],
        output_name: str | None = None,
        llm_client: Any | None = None,
    ) -> str:
        """Render HTML file with charts via Chart.js."""
        if isinstance(template_style, dict):
            style = template_style
        else:
            style = self._get_template_style(template_style)
        renderer = HTMLRenderer(style, llm_client=llm_client)

        topic = content_structure.get('topic', 'presentation')
        safe_topic = "".join(c for c in topic if c.isalnum() or c in (' ', '-', '_'))
        safe_topic = safe_topic.replace(' ', '_') or "presentation"
        safe_topic = safe_topic[:40].rstrip("_-")
        base_name = output_name or safe_topic
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{base_name}_{timestamp}.html"
        filepath = os.path.join('/tmp', filename)

        await renderer.render(content_structure, layouts, filepath)
        print(f"   ✓ Saved HTML file")
        return filepath
    
    def _should_have_chart(self, slide: Dict[str, Any]) -> bool:
        """Determine if slide should have a chart based on plan constraints and content_type.

        Only checks title and bullet content — NOT the entire slide dict
        (which includes RAG evidence, speaker notes, etc. that cause false positives).
        """
        ctype = slide.get('content_type', '')
        if slide.get('slide_number') == 1 or ctype == 'title':
            return False
        if ctype in {'thanks', 'conclusion'}:
            return False

        # Slide-level content_type wins — this is set by _enforce_prompt_requirements
        if ctype in {'chart', 'comparison'}:
            return True

        constraints = slide.get('_plan_constraints') or {}
        if isinstance(constraints, dict):
            if constraints.get('must_render_chart'):
                return True
            # Only block if constraints explicitly set a non-chart type
            # AND the slide's own content_type wasn't overridden to chart
            ct = constraints.get('content_type', '')
            if ct and ct != 'chart' and ctype not in {'chart', 'comparison'}:
                return False

        keywords = [
            'data', 'statistics', 'metrics', 'growth', 'market',
            'revenue', 'sales', 'trend', 'comparison', 'performance',
            'rate', 'percent', 'share', 'adoption', 'forecast',
            'cagr', 'roi', 'kpi', 'benchmark',
        ]

        title_text = str(slide.get('title', '')).lower()
        content_items = slide.get('content', [])
        content_text = ' '.join(str(c) for c in content_items).lower() if isinstance(content_items, list) else ''
        check_text = f"{title_text} {content_text}"
        return any(keyword in check_text for keyword in keywords)

    def _get_design_guidelines(self) -> str:
        """Global soft guidelines applied to all decks."""
        return (
            "IR DECK GUIDELINES:\n\n"
            "CONTENT RULES:\n"
            "- Max 1 primary message per slide. Split overloaded slides.\n"
            "- Every claim must be quantified where possible. No 'significant' or 'rapid' without a number.\n"
            "- If data is inferred, use 'estimated' or 'projected' phrasing (do NOT show 'Assumption:' labels in final copy).\n"
            "- A reviewer should grasp each slide in 5 seconds or less.\n\n"
            "VISUAL RULES:\n"
            "- Use charts when they improve clarity over text.\n"
            "- Pie charts only for 5 or fewer segments.\n"
            "- Prefer small, focused visuals over decorative ones.\n"
            "- Prefer diverse layouts; avoid repeating the same layout type.\n\n"
            "COVERAGE (ensure at least one slide each):\n"
            "- Market opportunity\n"
            "- Solution / Technology\n"
            "- Commercialization / Go-to-market\n"
            "- Team / Company\n"
            "- Risk / Compliance / Safety\n\n"
            "NARRATIVE:\n"
            "- Follow: Problem → Approach → Execution → Capability → Risk Control\n"
            "- If reordered, add clear signposting transitions between sections.\n\n"
            "TONE:\n"
            "- Neutral, professional. No hype words (revolutionary, game-changing, disruptive).\n"
            "- Write as a senior IR consultant, not a marketer.\n"
            "- Pragmatic visuals over novelty.\n"
        )
    
    def _get_template_style(self, template: str) -> Dict[str, Any]:
        """Get template styling"""
        
        templates = {
            'corporate': {
                'id': 'corporate',
                'name': 'Corporate Professional',
                'mode': 'light',
                'colors': {
                    'primary': (30, 64, 175),    # Navy blue
                    'secondary': (59, 130, 246),  # Blue
                    'accent': (96, 165, 250),      # Light blue
                    'background': (248, 250, 252),
                },
                'fonts': {
                    'title': 'Calibri',
                    'body': 'Calibri'
                },
                'theme_brief': (
                    "Executive corporate theme with navy/blue palette. Clean grid, "
                    "high whitespace, crisp dividers, subtle gradients."
                ),
                'chrome': {
                    'primary': (30, 64, 175),
                    'secondary': (96, 165, 250),
                    'light': (226, 232, 240)
                }
            },
            'modern': {
                'id': 'modern',
                'name': 'Modern & Bold',
                'mode': 'dark',
                'colors': {
                    'primary': (124, 58, 237),    # Purple
                    'secondary': (167, 139, 250),  # Light purple
                    'accent': (196, 181, 253),      # Lighter purple
                    'background': (10, 10, 15),
                },
                'fonts': {
                    'title': 'Arial',
                    'body': 'Arial'
                },
                'theme_brief': (
                    "Dark tech theme with vibrant violet accents, soft glow, "
                    "layered gradients, bold contrast, futuristic but clean."
                ),
                'chrome': {
                    'primary': (124, 58, 237),
                    'secondary': (196, 181, 253),
                    'light': (237, 233, 254)
                }
            },
            'minimal': {
                'id': 'minimal',
                'name': 'Minimal Clean',
                'mode': 'light',
                'colors': {
                    'primary': (0, 0, 0),         # Black
                    'secondary': (107, 114, 128),  # Gray
                    'accent': (156, 163, 175),      # Light gray
                    'background': (255, 255, 255),
                },
                'fonts': {
                    'title': 'Helvetica',
                    'body': 'Helvetica'
                },
                'theme_brief': (
                    "Minimalist theme with monochrome palette, thin lines, "
                    "airy spacing, no heavy gradients, editorial clarity."
                ),
                'chrome': {
                    'primary': (0, 0, 0),
                    'secondary': (156, 163, 175),
                    'light': (229, 231, 235)
                }
            },
            'creative': {
                'id': 'creative',
                'name': 'Creative & Colorful',
                'mode': 'light',
                'colors': {
                    'primary': (220, 38, 38),     # Red
                    'secondary': (248, 113, 113),  # Light red
                    'accent': (252, 165, 165),      # Lighter red
                    'background': (255, 247, 245),
                },
                'fonts': {
                    'title': 'Georgia',
                    'body': 'Calibri'
                },
                'theme_brief': (
                    "Warm creative theme with energetic reds, soft blobs, "
                    "rounded cards, playful but still professional."
                ),
                'chrome': {
                    'primary': (220, 38, 38),
                    'secondary': (252, 165, 165),
                    'light': (254, 226, 226)
                }
            },
            'black-elegant': {
                'id': 'black-elegant',
                'name': 'Black Elegant',
                'mode': 'light',
                'colors': {
                    'primary': (0, 0, 0),          # Black
                    'secondary': (229, 225, 218),  # Warm light gray
                    'accent': (255, 217, 68),       # Gold accent
                    'background': (251, 249, 241),
                },
                'fonts': {
                    'title': 'Poppins Bold',
                    'body': 'Lato'
                },
                'theme_brief': (
                    "Luxury minimal theme with black and gold accents, "
                    "bold typography, elegant spacing, subtle geometric panels."
                ),
                'disable_chrome': True,
                'chrome': {
                    'primary': (0, 0, 0),
                    'secondary': (255, 217, 68),
                    'light': (229, 225, 218)
                },
                'backgrounds': {
                    'title': {'type': 'solid', 'color': (229, 225, 218)},
                    'content': {'type': 'solid', 'color': (251, 249, 241)}
                },
                'overlays': {
                    'cover': [],
                    'section': [
                        {'shape': 'rect', 'x': 0.0, 'y': 0.0, 'w': 4.36, 'h': 1.80, 'fill': (0, 0, 0)}
                    ],
                    'content': [
                        {'shape': 'rect', 'x': 0.0, 'y': 0.0, 'w': 3.62, 'h': 2.34, 'fill': (0, 0, 0)}
                    ]
                }
            },
            'full-styled-ir': {
                'id': 'full-styled-ir',
                'name': 'Full Styled IR',
                'mode': 'light',
                'colors': {
                    'primary': (0, 51, 102),     # Navy
                    'secondary': (46, 117, 182), # Blue
                    'accent': (255, 192, 0),      # Yellow
                    'background': (255, 255, 255),
                },
                'fonts': {
                    'title': 'Calibri',
                    'body': 'Calibri'
                },
                'theme_brief': (
                    "Structured IR theme with navy + yellow contrast, "
                    "strong panels, angled accents, disciplined grid."
                ),
                'chrome': {
                    'primary': (0, 51, 102),
                    'secondary': (46, 117, 182),
                    'light': (226, 232, 240)
                },
                'backgrounds': {
                    'title': {'type': 'solid', 'color': (255, 255, 255)},
                    'content': {'type': 'solid', 'color': (255, 255, 255)}
                }
            },
            'bold': {
                'id': 'bold',
                'name': 'Bold Contrast',
                'mode': 'dark',
                'colors': {
                    'primary': (15, 23, 42),
                    'secondary': (30, 64, 175),
                    'accent': (234, 88, 12),
                    'background': (10, 10, 15),
                },
                'fonts': {
                    'title': 'Arial',
                    'body': 'Arial',
                },
                'theme_brief': (
                    "High-contrast dark theme with bold orange accents, "
                    "large typography, dramatic hierarchy, strong diagonals."
                ),
                'chrome': {
                    'primary': (30, 64, 175),
                    'secondary': (234, 88, 12),
                    'light': (71, 85, 105),
                },
            },
            'editorial': {
                'id': 'editorial',
                'name': 'Editorial Warm',
                'mode': 'light',
                'colors': {
                    'primary': (55, 65, 81),
                    'secondary': (120, 53, 15),
                    'accent': (217, 119, 6),
                    'background': (255, 251, 235),
                },
                'fonts': {
                    'title': 'Georgia',
                    'body': 'Georgia',
                },
                'theme_brief': (
                    "Warm editorial theme with soft parchment background, "
                    "serif typography, subtle grain, calm sophistication."
                ),
                'chrome': {
                    'primary': (55, 65, 81),
                    'secondary': (217, 119, 6),
                    'light': (254, 243, 199),
                },
            },
            'wecommit': {
                'id': 'wecommit',
                'name': 'WeCommit Gradient',
                'mode': 'dark',
                'colors': {
                    'primary': (37, 99, 235),
                    'secondary': (14, 165, 233),
                    'accent': (255, 255, 255),
                    'background': (10, 15, 30),
                },
                'fonts': {
                    'title': 'Calibri',
                    'body': 'Calibri',
                },
                'theme_brief': (
                    "Blue gradient tech theme with glossy cards, "
                    "rounded edges, glassy highlights, energetic motion."
                ),
                'chrome': {
                    'primary': (37, 99, 235),
                    'secondary': (14, 165, 233),
                    'light': (191, 219, 254),
                },
            },
            'simple-business': {
                'id': 'simple-business',
                'name': 'Simple Business',
                'mode': 'light',
                'colors': {
                    'primary': (30, 64, 175),
                    'secondary': (59, 130, 246),
                    'accent': (96, 165, 250),
                    'background': (248, 250, 252),
                },
                'fonts': {
                    'title': 'Calibri',
                    'body': 'Calibri',
                },
                'theme_brief': (
                    "Classic business theme with light blue accents, "
                    "clean cards, thin dividers, understated gradients."
                ),
                'chrome': {
                    'primary': (30, 64, 175),
                    'secondary': (96, 165, 250),
                    'light': (226, 232, 240),
                },
            },
            'ir-deck': {
                'id': 'ir-deck',
                'name': 'IR Deck',
                'mode': 'light',
                'colors': {
                    'primary': (14, 116, 144),
                    'secondary': (56, 189, 248),
                    'accent': (186, 230, 253),
                    'background': (240, 249, 255),
                },
                'fonts': {
                    'title': 'Calibri',
                    'body': 'Calibri',
                },
                'theme_brief': (
                    "IR-focused light blue theme, calm gradients, "
                    "clear hierarchy, restrained visuals."
                ),
                'chrome': {
                    'primary': (14, 116, 144),
                    'secondary': (56, 189, 248),
                    'light': (186, 230, 253),
                },
            },
        }
        
        return templates.get(template, templates['corporate'])

    def _hex_to_rgb_tuple(self, value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
        if not isinstance(value, str):
            return fallback
        hex_value = value.strip().lstrip("#")
        if len(hex_value) != 6:
            return fallback
        try:
            return (
                int(hex_value[0:2], 16),
                int(hex_value[2:4], 16),
                int(hex_value[4:6], 16),
            )
        except ValueError:
            return fallback

    def _tint_color(self, rgb: tuple[int, int, int], factor: float = 0.2) -> tuple[int, int, int]:
        """Lighten a color by mixing with white (factor 0-1)."""
        factor = max(0.0, min(1.0, factor))
        return tuple(
            min(255, int(channel + (255 - channel) * factor))
            for channel in rgb
        )

    async def _generate_ai_theme_style(
        self,
        topic: str,
        tone: str,
        template_hint: str | None = None,
    ) -> Dict[str, Any]:
        """Generate a theme using the LLM for varied colors/gradients."""
        if not self.llm_client:
            return self._get_template_style("corporate")

        system_prompt = "Return only valid JSON."
        hint_text = f"Template hint: {template_hint}" if template_hint else ""
        user_prompt = f"""Create a professional slide theme for an investor deck.

Topic: {topic}
Tone: {tone}
{hint_text}

Return JSON with this schema:
{{
  "name": "Theme name",
  "mode": "light|dark",
  "palette": {{
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "surface": "#RRGGBB",
    "text": "#RRGGBB",
    "text_muted": "#RRGGBB"
  }},
  "gradients": {{
    "primary": "linear-gradient(...)"
  }},
  "fonts": {{
    "title": "Font name",
    "body": "Font name"
  }},
  "brief": "One-sentence design brief"
}}

Rules:
- Use accessible contrast for text.
- Keep it professional (no neon).
- Background should be light if mode=light, dark if mode=dark.
- Fonts should be commonly available (Calibri, Arial, Helvetica, Georgia).
"""
        try:
            result = await self.llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6,
                max_tokens=600,
                response_format="json",
            )
        except Exception:
            return self._get_template_style("corporate")

        palette = (result or {}).get("palette") or {}
        fonts = (result or {}).get("fonts") or {}
        gradients = (result or {}).get("gradients") or {}
        mode = str((result or {}).get("mode") or "light").lower()
        brief = (result or {}).get("brief") or "AI-generated theme."

        primary_rgb = self._hex_to_rgb_tuple(palette.get("primary", ""), (30, 64, 175))
        secondary_rgb = self._hex_to_rgb_tuple(palette.get("secondary", ""), (59, 130, 246))
        accent_rgb = self._hex_to_rgb_tuple(palette.get("accent", ""), (96, 165, 250))
        background_rgb = self._hex_to_rgb_tuple(
            palette.get("background", ""),
            (255, 255, 255) if mode == "light" else (10, 10, 15),
        )

        style = {
            "id": "ai-generated",
            "name": str((result or {}).get("name") or "AI Theme"),
            "mode": "dark" if mode == "dark" else "light",
            "colors": {
                "primary": primary_rgb,
                "secondary": secondary_rgb,
                "accent": accent_rgb,
                "background": background_rgb,
            },
            "fonts": {
                "title": str(fonts.get("title") or "Calibri"),
                "body": str(fonts.get("body") or "Calibri"),
            },
            "theme_brief": str(brief),
            "chrome": {
                "primary": primary_rgb,
                "secondary": secondary_rgb,
                "light": self._tint_color(primary_rgb, 0.75),
            },
            "backgrounds": {
                "title": {"type": "solid", "color": background_rgb},
                "content": {"type": "solid", "color": background_rgb},
            },
        }

        if isinstance(gradients.get("primary"), str) and gradients.get("primary"):
            style["gradients"] = {"primary": gradients["primary"]}

        return style

    async def _resolve_template_style(
        self,
        template_style: str | None,
        topic: str,
        tone: str,
        template_hint: str | None = None,
    ) -> Dict[str, Any]:
        if not template_style or str(template_style).strip().lower() in {"auto", "ai", "generated"}:
            return await self._generate_ai_theme_style(topic, tone, template_hint=template_hint)
        return self._get_template_style(str(template_style).strip().lower())


# Example usage
async def main():
    """Demo the advanced system"""
    
    # Use mock client for demo
    from utils.llm_client import MockLLMClient
    llm_client = MockLLMClient()
    
    orchestrator = AdvancedDeckOrchestrator(llm_client)
    
    pptx_path = await orchestrator.create_advanced_presentation(
        topic="The Future of Renewable Energy",
        num_slides=12,
        template_style="modern",
        tone="professional"
    )
    
    print(f"\n🎉 Presentation created: {pptx_path}")
    print("\nFeatures:")
    print("✅ AI-generated content")
    print("✅ AI-decided layouts (different for each slide)")
    print("✅ Real charts rendered in PPTX")
    print("✅ Canva-style professional design")
    print("✅ Multiple layout patterns")
    print("✅ Fully editable PowerPoint file")


if __name__ == "__main__":
    asyncio.run(main())
