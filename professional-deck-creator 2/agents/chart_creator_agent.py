"""
Chart Creator Agent
Designs data visualizations and chart specifications
"""

from typing import Dict, Any, List
import os
import re
from datetime import datetime
from .base_agent import BaseAgent


class ChartCreatorAgent(BaseAgent):
    """
    Chart Creator Agent - Designs visualizations
    
    Responsibilities:
    - Choose appropriate chart types
    - Create chart data specifications
    - Design clear, informative visualizations
    - Ensure data accuracy and clarity
    """
    
    def __init__(self, llm_client):
        super().__init__(llm_client, "ChartCreator")
        
    def get_system_prompt(self) -> str:
        return """You are an expert Data Visualization Agent for investment-grade IR decks.
Your charts must be boardroom-ready: clear, impactful, and immediately persuasive to sophisticated investors.

=== IR CHART PHILOSOPHY ===
Every chart tells one story. Investors scan charts in 3 seconds — your visualization must
communicate the key insight instantly. No clutter, no ambiguity, no generic graphics.

CORE RESPONSIBILITIES:
1. Create charts that drive investment conviction
2. Visualize growth trajectories and market opportunities
3. Use color strategically to highlight key data points
4. Ensure data credibility (realistic magnitudes, proper sourcing)
5. Make the "so what" immediately obvious

=== CHART TYPE SELECTION (IR-Optimized) ===

GROWTH & TRAJECTORY (most common in IR):
- column: YoY/QoQ revenue growth, ARR progression, customer growth
- line: Trend lines, market projections, financial forecasts
- area: Cumulative metrics, market size evolution

MARKET & COMPOSITION:
- bar: Competitive positioning, market share comparison, feature comparison
- pie: Revenue mix, market segmentation (MAX 4-5 segments, must sum to ~100%)
- doughnut: TAM/SAM/SOM visualization, portfolio allocation

=== CHART TITLE RULES (CRITICAL FOR IR) ===
The title is your headline — it must state the INSIGHT, not describe the data:
- BAD: "Revenue by Year"  →  GOOD: "Revenue Tripled to $45M in 3 Years"
- BAD: "Market Share"  →  GOOD: "Captured 23% of Enterprise Segment in 18 Months"
- BAD: "Customer Growth"  →  GOOD: "Customer Base Expanded 4.5x Since 2022"

=== INVESTOR-GRADE DESIGN PRINCIPLES ===

VISUAL HIERARCHY:
- The trend or comparison must be visible from 10 feet away
- Use accent color ONLY on the most important data point
- Gray out or mute secondary data to focus attention

SCALE & CREDIBILITY:
- Start bar/column charts at 0 (investors notice distortions)
- Use realistic magnitudes: startup = $1-100M, scale-up = $100M-1B
- If RAG provides numbers, use those EXACTLY — don't invent
- Add context: "+47% YoY", "vs. $12M target"

COLOR STRATEGY:
- Primary data: bold, saturated color (#1E40AF, #0F766E, #0369A1)
- Secondary data: muted versions or gray (#94A3B8)
- Highlight: accent color for the key metric (#F59E0B, #EF4444)
- NEVER use rainbow colors — stick to 2-3 colors max

LABELS & ANNOTATIONS:
- Short, scannable labels: "Q1'24" not "Quarter 1, 2024"
- Add growth percentages inline: "$45M (+173%)"
- Y-axis: "$M" not "Revenue in Millions of US Dollars"

=== DATA REQUIREMENTS ===
- 4-6 data points (optimal for comprehension)
- Specific values, not ranges
- Logical ordering: chronological or by magnitude
- Consistent units throughout

=== CRITICAL RULE — NEVER REFUSE ===
- You MUST always return a valid chart specification
- If evidence is sparse, generate reasonable estimates based on industry benchmarks
- A chart with estimated data is ALWAYS better than no chart
- Note "Projected" or "Estimated" in the insight when data is inferred

Always respond with valid JSON:
{
    "chart_type": "bar|column|line|pie|doughnut|area",
    "title": "Insight-driven headline (not a label)",
    "data": [100, 150, 200, 250, 300],
    "labels": ["2021", "2022", "2023", "2024", "2025"],
    "colors": ["#0F766E", "#14B8A6", "#5EEAD4", "#99F6E4", "#CCFBF1"],
    "axes_labels": {"x": "Year", "y": "$M"},
    "insight": "What this chart proves to investors"
}"""

    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        slide = input_data.get('slide', {})
        rag_evidence = input_data.get('rag_evidence', '')
        plan_constraints = input_data.get('plan_constraints', {}) or slide.get('_plan_constraints', {})
        
        title = slide.get('title', '')
        content = slide.get('content', [])
        speaker_notes = slide.get('speaker_notes', '')
        
        prompt = f"""Design a data visualization for this slide:

SLIDE TITLE: {title}

CONTENT:
{chr(10).join(f'- {item}' for item in content if isinstance(item, str))}

SPEAKER NOTES: {speaker_notes}

TASK:
Analyze the slide content and create a chart specification that:
1. Visualizes the key data or trends mentioned
2. Chooses the most appropriate chart type
3. Provides realistic, representative data
4. Highlights the main insight

REQUIREMENTS:
- Extract or infer numerical data from the content
- Create 4-6 data points with clear labels
- Choose colors that match professional presentation standards
- Provide specific numbers (not placeholders)
- Ensure the chart directly supports the slide message
- If no evidence is available, generate reasonable estimates and keep the insight neutral

CHART TYPE CONSTRAINTS:
- Choose chart_type only from allowed_chart_types when provided.
- If allowed_chart_types is empty or missing, pick the best fit from: bar, column, line, pie, doughnut, area.

If the content mentions:
- Growth/trends over time → use line or column/bar chart
- Comparisons between categories → use bar chart
- Market share or proportions → use pie or doughnut chart
- Multiple metrics → use appropriate comparison chart

Provide specific, realistic numbers that tell a compelling story."""

        if plan_constraints:
            allowed = plan_constraints.get('allowed_chart_types', [])
            allowed_text = ", ".join(allowed) if allowed else "none"
            prompt += f"""

allowed_chart_types: {allowed_text}
must_render_chart: {plan_constraints.get('must_render_chart', False)}
"""

        if rag_evidence:
            prompt += f"""

RAG EVIDENCE (use numeric values from here first):
{rag_evidence}
"""

        ir_tables = input_data.get('ir_tables')
        if ir_tables:
            prompt += f"""

IR DATA TABLES (prefer numeric values from these tables; do not invent):
{ir_tables}
"""

        guidelines = input_data.get('design_guidelines', '')
        if guidelines:
            prompt += f"""

DESIGN GUIDELINES (follow these):
{guidelines}
"""

        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute chart creation task"""
        start_time = datetime.now()
        research_chart_data = input_data.get('research_chart_data')
        plan_constraints = input_data.get('plan_constraints')
        
        try:
            # Check if chart is actually needed
            slide = input_data.get('slide', {})
            if not self._should_create_chart(slide, plan_constraints):
                return {"chart_created": False}

            allowed = []
            if isinstance(plan_constraints, dict):
                allowed = list(plan_constraints.get('allowed_chart_types') or [])
            supported = self._supported_chart_types()
            if allowed:
                allowed = [a for a in allowed if a in supported]
            if isinstance(plan_constraints, dict) and plan_constraints.get('must_render_chart') and not allowed:
                return {"status": "UNSUPPORTED", "reason": "no_supported_chart_types"}
            
            user_prompt = self.get_user_prompt(input_data)
            response = await self.call_llm(
                user_prompt=user_prompt,
                temperature=0.6,
                max_tokens=800
            )
            
            # Validate and clean response
            response = self._validate_chart_spec(response, plan_constraints)
            if research_chart_data:
                response = self._merge_research_chart_data(response, research_chart_data)
                response = self._validate_chart_spec(response, plan_constraints)
            
            duration = (datetime.now() - start_time).total_seconds()
            self.track_execution(duration)
            
            return response
            
        except Exception as e:
            return self.get_fallback_response(str(e))
    
    def _should_create_chart(
        self,
        slide: Dict[str, Any],
        plan_constraints: Dict[str, Any] | None = None,
    ) -> bool:
        """Determine if slide needs a chart"""
        constraints = plan_constraints or slide.get('_plan_constraints') or {}
        if constraints.get('must_render_chart'):
            return True
        if constraints.get('content_type') and constraints.get('content_type') != 'chart':
            return False
        content_type = slide.get('content_type', '')

        if content_type in {'chart', 'comparison'}:
            return True

        # Check for data-related keywords in title and content only
        # (NOT the entire slide dict which includes RAG evidence, speaker notes, etc.)
        keywords = [
            'data', 'statistics', 'metrics', 'numbers', 'growth',
            'revenue', 'market', 'sales', 'performance', 'trend',
            'comparison', 'versus', 'increase', 'decrease', 'rate',
            'percentage', 'share', 'distribution', 'analysis'
        ]

        title_text = str(slide.get('title', '')).lower()
        content_items = slide.get('content', [])
        content_text = ' '.join(str(c) for c in content_items).lower() if isinstance(content_items, list) else ''
        check_text = f"{title_text} {content_text}"
        return any(keyword in check_text for keyword in keywords)
    
    def _validate_chart_spec(
        self,
        spec: Dict[str, Any],
        plan_constraints: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Validate and clean chart specification"""
        # Ensure required fields
        if 'chart_type' not in spec:
            spec['chart_type'] = 'bar'
        
        if 'data' not in spec or not spec['data']:
            spec['data'] = [100, 150, 200, 250, 300]
        else:
            spec['data'] = self._sanitize_series_data(spec['data'])
        
        if 'labels' not in spec or not spec['labels']:
            spec['labels'] = [f"Item {i+1}" for i in range(len(spec['data']))]
        
        # Ensure data and labels match
        data_len = len(spec['data'])
        label_len = len(spec['labels'])
        
        if data_len != label_len:
            if data_len > label_len:
                spec['labels'].extend([f"Item {i+1}" for i in range(label_len, data_len)])
            else:
                spec['labels'] = spec['labels'][:data_len]

        # Ensure minimum data points for meaningful charts
        if len(spec['data']) < 3:
            spec['data'], spec['labels'] = self._expand_sparse_series(
                spec['data'], spec['labels']
            )

        # Normalize and shorten labels
        spec['labels'] = [self._shorten_label(label) for label in spec['labels']]

        # Ensure labels are unique to avoid chart duplication
        seen = {}
        unique_labels = []
        for label in spec['labels']:
            label_str = str(label).strip() or "Item"
            count = seen.get(label_str, 0)
            if count == 0:
                unique_labels.append(label_str)
            else:
                unique_labels.append(f"{label_str} ({count + 1})")
            seen[label_str] = count + 1
        spec['labels'] = unique_labels
        
        # Limit to reasonable number of data points
        if len(spec['data']) > 8:
            spec['data'] = spec['data'][:8]
            spec['labels'] = spec['labels'][:8]
        
        # Ensure colors
        if 'colors' not in spec or not spec['colors']:
            spec['colors'] = self._get_default_colors(len(spec['data']))
        
        # Ensure enough colors
        if len(spec['colors']) < len(spec['data']):
            default_colors = self._get_default_colors(len(spec['data']))
            spec['colors'].extend(default_colors[len(spec['colors']):])
        
        # Add default axes labels if missing
        if 'axes_labels' not in spec:
            spec['axes_labels'] = {'x': 'Category', 'y': 'Value'}

        # Series name should be short (avoid using the full title in legends)
        if not spec.get('series_name'):
            spec['series_name'] = spec.get('axes_labels', {}).get('y', 'Value')
        spec['series_name'] = self._shorten_series_name(spec['series_name'])

        constraints = plan_constraints or {}
        allowed = constraints.get('allowed_chart_types') if isinstance(constraints, dict) else None
        supported = self._supported_chart_types()
        if isinstance(allowed, list) and allowed:
            filtered = [a for a in allowed if a in supported]
            if filtered and spec.get('chart_type') not in filtered:
                spec['chart_type'] = filtered[0]
        
        return spec

    @staticmethod
    def _supported_chart_types() -> List[str]:
        return ["bar", "column", "line", "pie", "doughnut", "area"]

    def _expand_sparse_series(self, data: List[float], labels: List[str]) -> tuple[List[float], List[str]]:
        """Expand 1–2 data points into a minimal 3-point series."""
        if len(data) >= 3:
            return data, labels
        if not data:
            data = [100, 150, 200]
        if len(data) == 1:
            base = data[0]
            data = [round(base * 0.8, 2), round(base * 0.9, 2), base]
        elif len(data) == 2:
            a, b = data
            data = [a, round((a + b) / 2, 2), b]

        expanded_labels = self._expand_labels(labels, len(data))
        return data, expanded_labels

    def _expand_labels(self, labels: List[str], target_len: int) -> List[str]:
        """Generate labels when data is expanded."""
        import re
        labels = [str(l) for l in (labels or []) if str(l).strip()]
        year_pattern = re.compile(r'(19|20)\d{2}')

        if labels:
            years = []
            for label in labels:
                match = year_pattern.search(label)
                years.append(int(match.group(0)) if match else None)
            if any(years):
                year_vals = [y for y in years if y]
                year = year_vals[-1]
                prefix = "FY" if any("FY" in l for l in labels) else ""
                start = year - (target_len - 1)
                return [f"{prefix}{start + i}" for i in range(target_len)]

        return [f"Period {i + 1}" for i in range(target_len)]

    def _shorten_label(self, label: Any) -> str:
        """Keep labels concise for slide readability."""
        text = str(label).strip()
        if not text:
            return "Item"
        truncate = os.getenv("CHART_LABEL_TRUNCATE", "0").lower() in {"1", "true", "yes"}
        if not truncate:
            return re.sub(r"\s+", " ", text)
        max_len = int(os.getenv("CHART_LABEL_MAX_LEN", "18"))
        max_words = int(os.getenv("CHART_LABEL_MAX_WORDS", "3"))
        if len(text) <= max_len:
            return text
        # Prefer the most specific fragment after separators
        parts = re.split(r"[|:–-]+", text)
        parts = [p.strip() for p in parts if p.strip()]
        candidate = parts[-1] if parts else text
        candidate = re.sub(r"^(the|a|an|of|for|in|by|to)\s+", "", candidate, flags=re.IGNORECASE)
        if len(candidate) > max_len:
            words = candidate.split()
            if len(words) > max_words:
                candidate = " ".join(words[:max_words])
            if len(candidate) > max_len:
                candidate = candidate[: max(1, max_len - 1)] + "…"
        return candidate

    def _shorten_series_name(self, name: Any) -> str:
        text = str(name).strip()
        if not text:
            return "Value"
        max_len = int(os.getenv("CHART_SERIES_NAME_MAX_LEN", "12"))
        if len(text) <= max_len:
            return text
        return text[: max(1, max_len - 1)] + "…"

    def _sanitize_series_data(self, data: List[Any]) -> List[float]:
        """Ensure chart data is a flat list of numbers."""
        sanitized = []
        for item in data:
            value = None
            if isinstance(item, (int, float)):
                value = float(item)
            elif isinstance(item, str):
                try:
                    value = float(item.replace(',', '').strip())
                except ValueError:
                    value = None
            elif isinstance(item, dict):
                # Try common keys
                for key in ('value', 'amount', 'count', 'metric'):
                    if key in item:
                        try:
                            value = float(str(item[key]).replace(',', '').strip())
                            break
                        except ValueError:
                            value = None
                # Fallback: first numeric in dict values
                if value is None:
                    for v in item.values():
                        try:
                            value = float(str(v).replace(',', '').strip())
                            break
                        except ValueError:
                            continue
            if value is not None:
                sanitized.append(value)

        if not sanitized:
            return [100, 150, 200, 250, 300]

        return sanitized
    
    def _get_default_colors(self, count: int) -> List[str]:
        """Get investment-grade color palette — professional, high-contrast, boardroom-ready."""
        colors = [
            "#0F766E",  # Teal (primary, professional)
            "#1E40AF",  # Royal blue (secondary)
            "#0369A1",  # Ocean blue
            "#059669",  # Emerald
            "#7C3AED",  # Violet (accent)
            "#0891B2",  # Cyan
            "#4338CA",  # Indigo
            "#0D9488",  # Teal light
        ]

        # Repeat colors if needed
        while len(colors) < count:
            colors.extend(colors)

        return colors[:count]

    def _merge_research_chart_data(self, spec: Dict[str, Any], research_chart_data: Dict[str, Any]) -> Dict[str, Any]:
        """Merge chart data suggested by research when spec data is weak."""
        extracted = self._extract_chart_data_from_research(research_chart_data)
        if not extracted:
            return spec

        if self._is_default_series(spec.get('data', []), spec.get('labels', [])) or len(spec.get('data', [])) < 3:
            spec['data'] = extracted['data']
            spec['labels'] = extracted['labels']
            if extracted.get('chart_type'):
                spec['chart_type'] = extracted['chart_type']
        return spec

    def _extract_chart_data_from_research(self, research_chart_data: Dict[str, Any]) -> Dict[str, Any] | None:
        if not isinstance(research_chart_data, dict):
            return None

        data = []
        labels = []
        chart_type = research_chart_data.get('chart_type')
        if isinstance(chart_type, str) and '/' in chart_type:
            chart_type = chart_type.split('/')[0].strip()

        if 'data_points' in research_chart_data and isinstance(research_chart_data['data_points'], list):
            for point in research_chart_data['data_points']:
                if not isinstance(point, dict):
                    continue
                label = str(point.get('label', '')).strip()
                value = point.get('value')
                try:
                    value = float(str(value).replace(',', '').strip())
                except Exception:
                    value = None
                if label and value is not None:
                    labels.append(label)
                    data.append(value)
        else:
            labels = research_chart_data.get('labels') or research_chart_data.get('label') or []
            values = research_chart_data.get('values') or research_chart_data.get('data') or []
            if isinstance(labels, str):
                labels = [l.strip() for l in labels.split(',') if l.strip()]
            if isinstance(values, str):
                values = [v.strip() for v in values.split(',') if v.strip()]
            for label, value in zip(labels, values):
                try:
                    num = float(str(value).replace(',', '').strip())
                except Exception:
                    num = None
                if num is not None:
                    data.append(num)
                else:
                    data.append(0.0)

        if not data or not labels:
            return None

        return {
            'data': data,
            'labels': labels,
            'chart_type': chart_type
        }

    def _is_default_series(self, data: List[float], labels: List[str]) -> bool:
        default_data = [100, 150, 200, 250, 300]
        if data == default_data:
            return True
        if labels and all(str(l).lower().startswith('item') for l in labels):
            return True
        return False
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """Provide fallback chart if LLM fails"""
        return {
            "chart_type": "bar",
            "title": "Data Visualization",
            "data": [100, 150, 200, 250, 300],
            "labels": ["2020", "2021", "2022", "2023", "2024"],
            "colors": self._get_default_colors(5),
            "axes_labels": {
                "x": "Year",
                "y": "Value"
            },
            "insight": "Steady growth trend over time",
            "error": error
        }
