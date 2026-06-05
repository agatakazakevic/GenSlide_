"""
Planner Agent
Responsible for creating the presentation structure and outline
"""

from typing import Dict, Any
from datetime import datetime
from .base_agent import BaseAgent


class PlannerAgent(BaseAgent):
    """
    Planning Agent - Creates presentation structure
    
    Responsibilities:
    - Analyze topic and break it down into logical sections
    - Determine optimal slide count and flow
    - Assign content types to each slide
    - Create comprehensive outline with key points
    """
    
    def __init__(self, llm_client):
        super().__init__(llm_client, "Planner")
        
    def get_system_prompt(self) -> str:
        return """You are an expert Presentation Planning Agent. Your role is to create well-structured,
engaging presentation outlines that flow logically and captivate audiences.

CORE RESPONSIBILITIES:
1. Analyze topics and break them into clear, logical sections
2. Create compelling slide titles that grab attention
3. Determine optimal content type for each slide (text, chart, comparison, timeline, etc.)
4. Outline 3-5 key points for each slide
5. Ensure smooth narrative flow from introduction to conclusion
6. Flag missing inputs as specific questions for the user

NARRATIVE ARC (follow this structure as a guide):
1. Hook: Title slide that creates intrigue
2. Context: Problem/market landscape (why this matters)
3. Solution: What you're proposing (how it works)
4. Evidence: Data, traction, proof points (use charts here)
5. Differentiation: Why this beats alternatives
6. Execution: Team, roadmap, go-to-market
7. Ask: What you need, next steps / conclusion
Adapt this arc to the topic — not every deck is a pitch, but every deck needs a logical progression.

SLIDE TYPES:
- title: Main title slide
- text: Bullet points and paragraphs
- items: General-purpose items (1-6)
- steps: Sequential steps (3-5)
- summary: Final summary (1-5)
- comparison: Side-by-side comparisons (2 items)
- big_number: Key metrics (1-5)
- milestone: Key dates (3-5)
- pestel: Political/Economic/Social/Technological/Environmental/Legal
- swot: Strengths/Weaknesses/Opportunities/Threats
- pyramid: Hierarchical levels (1-5)
- timeline: Chronological events (3-5)
- funnel: Filtering/progression (3-5)
- quote: Impactful quote (1 item)
- cycle: Cyclical process (3-5)
- thanks: Closing thank-you slide
- chart: Data visualizations (use for numbers, trends, comparisons)
- table: Structured data table
- conclusion: Summary and next steps

BEST PRACTICES:
- Vary slide types to maintain engagement
- Use charts AGGRESSIVELY for any quantitative data — if a slide mentions numbers, growth, trends, comparisons, or market data, it MUST be content_type: "chart"
- Aim for at least 30-40% of body slides (excluding title/thanks) to be chart slides
- Keep one main idea per slide
- Create natural transitions between topics
- Balance information density
- Titles should state an insight or claim, not just a topic label
  BAD: "Market Overview"
  GOOD: "Enterprise AI Market Reaches $250B by 2027"

VISUAL INTENT:
Set visual_intent: true when the slide topic benefits from an illustration.
Good candidates: market/opportunity, strategy, risk/compliance, growth, go-to-market, product overview, technology.
Bad candidates: detailed data tables, SWOT/PESTEL grids, pure metric slides, quotes, title slides, closing/thanks slides.
When visual_intent is true, the system will reserve space for an illustration and reduce the text budget.
Use sparingly: aim for 30-50% of non-title slides to have visual_intent: true.

VISUAL INTENSITY (required):
Set visual_intensity to guide composition richness:
- low: minimal visuals, mostly text
- medium: balanced visuals + text
- high: strong visual composition, layered elements
- hero: bold, statement slide (typically title or key narrative pivot)

VISUAL COMPOSITION BRIEF (required, no coordinates):
Provide a short, creative direction without any layout coordinates.
Example:
{
  "style": "bold / layered / asymmetric",
  "metaphor": "double-edged sword",
  "primary_visual": "illustration / chart / diagram / typography",
  "mood": "urgent / confident / calm",
  "allowed_elements": ["overlapping shapes", "large typography", "icons", "decorative SVG"]
}
Do NOT include x/y/width/height or pixel values here.

INSTRUCTION FIELD — REQUIRED for every slide:
Write 1-2 sentences telling the content writer:
(a) what data/facts to research and include,
(b) what tone to strike on this specific slide,
(c) whether a chart insight headline is needed.

CONSTRAINTS FIELD — REQUIRED for every slide:
Provide machine-enforceable constraints derived from the content_type.
Example constraints:
{
  "intent": "market_sizing",
  "content_type": "chart",
  "allowed_chart_types": ["bar","column","line","pie","doughnut","area"],
  "must_render_chart": true,
  "required_fields": ["chart"],
  "required_labels": [],
  "numeric_required": true,
  "visual_required": true
}

Always respond with valid JSON in this exact format:
{
    "slides": [
        {
            "slide_number": 1,
            "intent": "market_sizing|problem|solution|technology|commercialization|company_intro|compliance|roadmap|traction|ask|other",
            "title": "Clear, compelling title",
            "content_type": "title|text|items|steps|summary|comparison|big_number|milestone|pestel|swot|pyramid|timeline|funnel|quote|cycle|thanks|chart|table|conclusion|concentric_circles",
            "key_points": ["Point 1", "Point 2", "Point 3"],
            "design_notes": "Visual design suggestions",
            "instruction": "Detailed instruction for content writer — what to research, what tone, whether chart headline needed",
            "constraints": {
                "intent": "market_sizing",
                "content_type": "chart",
                "allowed_chart_types": ["bar","column","line","pie","doughnut","area"],
                "must_render_chart": true,
                "required_fields": ["chart"],
                "required_labels": [],
                "numeric_required": true,
                "visual_required": true
            },
            "visual_intent": false,
            "visual_intensity": "low",
            "visual_composition": {
                "style": "clean / balanced",
                "metaphor": "",
                "primary_visual": "chart",
                "mood": "confident",
                "allowed_elements": ["grid", "icons"]
            }
        }
    ],
    "flow_notes": "Overall narrative flow explanation",
    "questions": [
        "Question 1 if critical info is missing (else empty list)"
    ]
}

EXAMPLE SLIDE ENTRY:
{
    "slide_number": 3,
    "intent": "market_sizing",
    "title": "Enterprise AI Market Hits $250B by 2027",
    "content_type": "chart",
    "key_points": ["Market growing at 25% CAGR", "Enterprise segment leads adoption", "North America holds 45% share"],
    "design_notes": "Bar chart with 5-year growth trajectory",
    "instruction": "Find recent market sizing data. Lead with TAM figure. Create a bar chart showing 5-year growth. Tone: authoritative, data-driven. Include a chart insight headline.",
    "constraints": {
        "intent": "market_sizing",
        "content_type": "chart",
        "allowed_chart_types": ["bar","column","line"],
        "must_render_chart": true,
        "required_fields": ["chart"],
        "required_labels": [],
        "numeric_required": true,
        "visual_required": true
    },
    "visual_intent": false,
    "visual_intensity": "medium",
    "visual_composition": {
        "style": "data-forward / clean",
        "metaphor": "",
        "primary_visual": "chart",
        "mood": "authoritative",
        "allowed_elements": ["grid", "icons", "accent bars"]
    }
}"""

    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        topic = input_data.get('topic', '')
        num_slides = input_data.get('num_slides', 10)
        style = input_data.get('style', 'professional')
        preferences = input_data.get('preferences', {})
        
        prompt = f"""Create a comprehensive presentation plan:

TOPIC: {topic}
NUMBER OF SLIDES: {num_slides}
STYLE: {style}

"""
        
        if preferences:
            prompt += f"PREFERENCES:\n"
            for key, value in preferences.items():
                prompt += f"- {key}: {value}\n"
            prompt += "\n"
            if preferences.get("design_guidelines"):
                prompt += f"DESIGN GUIDELINES (soft, follow if possible):\n{preferences['design_guidelines']}\n\n"
        
        prompt += f"""REQUIREMENTS:
1. Create exactly {num_slides} slides
2. Start with a title slide
3. End with a conclusion slide
4. Use diverse content types (include chart/table when data appears)
5. Ensure logical flow and progression
6. Make titles engaging and specific

GUIDELINES FOR CHART SLIDES:
- Use charts for: market data, statistics, trends, comparisons, growth metrics, KPIs, financials, adoption rates, benchmarks
- At least 30-40% of body slides should be content_type: "chart"
- Chart slide titles should clearly indicate what data is shown
- Include key data points in key_points
- When in doubt between "text" and "chart", choose "chart" — data visualizations are always more impactful

Please provide a detailed plan with rich, specific content for each slide.
Also include a concise "instruction" per slide that tells the next agent
what to research and how to write the slide (e.g., tone, data needs, charts).
Include visual_intensity and a visual_composition brief for each slide.
If critical info is missing, add questions to the top-level "questions" list."""

        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute planning task"""
        start_time = datetime.now()
        
        try:
            user_prompt = self.get_user_prompt(input_data)
            response = await self.call_llm(
                user_prompt=user_prompt,
                temperature=0.8,  # Higher for creativity
                max_tokens=4500
            )
            
            # Validate response
            if 'slides' not in response or not response['slides']:
                raise ValueError("Invalid response: missing slides")
            
            # Ensure correct number of slides
            slides = response['slides']
            num_slides = input_data.get('num_slides', 10)
            
            if len(slides) != num_slides:
                # Adjust if needed
                if len(slides) < num_slides:
                    # Add more slides
                    for i in range(len(slides), num_slides):
                        slides.append({
                            "slide_number": i + 1,
                            "title": f"Additional Topic {i - len(slides) + 1}",
                            "content_type": "text",
                            "key_points": ["Key point 1", "Key point 2", "Key point 3"],
                            "design_notes": "Standard layout"
                        })
                else:
                    # Trim excess slides
                    slides = slides[:num_slides]
            
            # Normalize slide numbers and ensure visual_intent
            for i, slide in enumerate(slides):
                slide['slide_number'] = i + 1
                if 'visual_intent' not in slide:
                    slide['visual_intent'] = False
                if 'instruction' not in slide:
                    slide['instruction'] = "Write concise, investor-ready content for this slide."
                ctype = slide.get('content_type', 'text')
                constraints = slide.get('constraints')
                defaults = self._build_constraints(ctype)
                if not isinstance(constraints, dict):
                    constraints = defaults
                else:
                    if not constraints.get('content_type'):
                        constraints['content_type'] = defaults['content_type']
                    if constraints.get('allowed_chart_types') in (None, []):
                        constraints['allowed_chart_types'] = defaults['allowed_chart_types']
                    if 'must_render_chart' not in constraints:
                        constraints['must_render_chart'] = defaults['must_render_chart']
                    if not constraints.get('required_fields'):
                        constraints['required_fields'] = defaults['required_fields']
                    if not constraints.get('required_labels'):
                        constraints['required_labels'] = defaults['required_labels']
                    if 'numeric_required' not in constraints:
                        constraints['numeric_required'] = defaults['numeric_required']
                    if 'visual_required' not in constraints:
                        constraints['visual_required'] = defaults['visual_required']
                    if not constraints.get('left_label'):
                        constraints['left_label'] = defaults.get('left_label', '')
                    if not constraints.get('right_label'):
                        constraints['right_label'] = defaults.get('right_label', '')
                    if not constraints.get('comparison_axis'):
                        constraints['comparison_axis'] = defaults.get('comparison_axis', '')
                if not slide.get('intent'):
                    slide['intent'] = self._derive_intent(slide)
                if not constraints.get('intent'):
                    constraints['intent'] = slide.get('intent', '')
                slide['constraints'] = constraints
            
            duration = (datetime.now() - start_time).total_seconds()
            self.track_execution(duration)
            
            return {
                "slides": slides,
                "flow_notes": response.get('flow_notes', ''),
                "questions": response.get('questions', []),
                "topic": input_data.get('topic', ''),
                "metadata": {
                    "agent": self.agent_name,
                    "execution_time": duration
                }
            }
            
        except Exception as e:
            return self.get_fallback_response(str(e))

    @staticmethod
    def _derive_intent(slide: Dict[str, Any]) -> str:
        title = str(slide.get('title', '')).lower()
        content_type = str(slide.get('content_type', '')).lower()
        if content_type == 'concentric_circles' or any(k in title for k in ('tam', 'sam', 'som', 'market size')):
            return 'market_sizing'
        if any(k in title for k in ('problem', 'pain', 'challenge', 'risk', 'threat')):
            return 'problem'
        if any(k in title for k in ('solution', 'platform', 'product', 'technology')):
            return 'solution'
        if any(k in title for k in ('roadmap', 'timeline', 'milestone')):
            return 'roadmap'
        if any(k in title for k in ('commercial', 'go-to-market', 'gtm', 'competition', 'competitive')):
            return 'commercialization'
        if any(k in title for k in ('team', 'company', 'introduction')):
            return 'company_intro'
        if any(k in title for k in ('security', 'safety', 'compliance', 'regulatory')):
            return 'compliance'
        if content_type == 'chart':
            return 'traction'
        return 'other'

    @staticmethod
    def _build_constraints(content_type: str) -> Dict[str, Any]:
        """Build default constraints from planner content_type."""
        ctype = str(content_type or 'text')
        constraints = {
            "intent": "",
            "content_type": ctype,
            "allowed_chart_types": [],
            "must_render_chart": False,
            "required_fields": [],
            "required_labels": [],
            "numeric_required": False,
            "visual_required": False,
            "left_label": "",
            "right_label": "",
            "comparison_axis": "",
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
        elif ctype in {"timeline", "milestone", "pestel", "swot", "pyramid", "funnel", "cycle", "steps", "items", "comparison"}:
            constraints["required_fields"] = ["content"]
            constraints["visual_required"] = True
            if ctype == "comparison":
                constraints["required_fields"] = ["left_items", "right_items"]
        return constraints
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """Provide fallback plan if LLM fails"""
        num_slides = 10
        return {
            "slides": [
                {
                    "slide_number": 1,
                    "intent": "other",
                    "title": "Presentation Title",
                    "content_type": "title",
                    "key_points": ["Introduction"],
                    "design_notes": "Bold title slide",
                    "instruction": "Create a compelling title and short subtitle only.",
                    "constraints": self._build_constraints("title"),
                    "visual_intent": False,
                },
                {
                    "slide_number": 2,
                    "intent": "other",
                    "title": "Overview",
                    "content_type": "text",
                    "key_points": ["Topic overview", "Key themes", "Objectives"],
                    "design_notes": "Clear bullet points",
                    "instruction": "Write 3-5 concise bullets introducing the topic.",
                    "constraints": self._build_constraints("text"),
                    "visual_intent": False,
                },
                {
                    "slide_number": 3,
                    "intent": "other",
                    "title": "Key Concepts",
                    "content_type": "text",
                    "key_points": ["Concept 1", "Concept 2", "Concept 3"],
                    "design_notes": "Visual layout",
                    "instruction": "Explain key concepts with short, parallel bullets.",
                    "constraints": self._build_constraints("text"),
                    "visual_intent": False,
                }
            ] + [
                {
                    "slide_number": i + 4,
                    "intent": "other",
                    "title": f"Topic {i + 1}",
                    "content_type": "text",
                    "key_points": ["Point 1", "Point 2", "Point 3"],
                    "design_notes": "Standard layout",
                    "instruction": "Provide concise bullets and add numeric evidence if possible.",
                    "constraints": self._build_constraints("text"),
                    "visual_intent": False,
                }
                for i in range(num_slides - 4)
            ] + [{
                "slide_number": num_slides,
                "intent": "other",
                "title": "Conclusion",
                "content_type": "conclusion",
                "key_points": ["Summary", "Next steps", "Call to action"],
                "design_notes": "Impactful closing",
                "instruction": "Summarize key takeaways and include a strong call-to-action.",
                "constraints": self._build_constraints("conclusion"),
                "visual_intent": False,
            }],
            "flow_notes": "Fallback plan generated due to error",
            "error": error
        }
