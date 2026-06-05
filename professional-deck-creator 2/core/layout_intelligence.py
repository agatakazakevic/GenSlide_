"""
Advanced Layout Intelligence Agent
Makes smart decisions about slide layouts, visual hierarchy, and design patterns
Like Canva/Beautifulc.ai - AI decides the best visual presentation
"""

from typing import Dict, Any, List
from enum import Enum
import json


class LayoutType(Enum):
    """Available layout patterns"""
    TITLE_ONLY = "title_only"
    SINGLE_COLUMN_TEXT = "single_column_text"
    TWO_COLUMN_TEXT_CHART = "two_column_text_chart"
    THREE_COLUMN_CARDS = "three_column_cards"
    FULL_CHART = "full_chart"
    SPLIT_COMPARISON = "split_comparison"
    TIMELINE_HORIZONTAL = "timeline_horizontal"
    GRID_2x2 = "grid_2x2"
    BIG_NUMBER_STATS = "big_number_stats"
    PROCESS_FLOW = "process_flow"
    QUOTE_CENTERED = "quote_centered"
    ITEMS = "items"
    STEPS = "steps"
    SUMMARY = "summary"
    COMPARISON = "comparison"
    BIG_NUMBER = "big_number"
    MILESTONE = "milestone"
    PESTEL = "pestel"
    SWOT = "swot"
    PYRAMID = "pyramid"
    TIMELINE = "timeline"
    FUNNEL = "funnel"
    QUOTE = "quote"
    CYCLE = "cycle"
    THANKS = "thanks"
    CHART = "chart"
    TABLE = "table"
    CONCENTRIC_CIRCLES = "concentric_circles"
    TITLE_COVER = "title_cover"
    # Illustration-variant layouts (natively reserve space for an image)
    TEXT_LEFT_ILLUSTRATION_RIGHT = "text_left_illustration_right"
    BIG_NUMBER_WITH_HERO_IMAGE = "big_number_with_hero_image"
    TIMELINE_WITH_BACKDROP = "timeline_with_backdrop"
    COMPARISON_WITH_CENTER_VISUAL = "comparison_with_center_visual"
    TEXT_CHART_MICRO_ILLUSTRATION = "text_chart_micro_illustration"


class LayoutDecisionAgent:
    """
    AI Agent that makes intelligent layout decisions
    Analyzes content and chooses optimal visual presentation
    """
    
    def __init__(self, llm_client):
        self.llm_client = llm_client
        
    async def decide_layout(
        self,
        slide_content: Dict[str, Any],
        slide_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Make intelligent layout decision based on content
        
        Returns:
            {
                "layout_type": "two_column_text_chart",
                "visual_hierarchy": {
                    "primary_focus": "chart",
                    "secondary_focus": "text"
                },
                "spacing": {
                    "left_column_width": 0.4,
                    "right_column_width": 0.6,
                    "padding": 0.5
                },
                "element_positions": {
                    "title": {"x": 0.5, "y": 0.5, "w": 9, "h": 0.8},
                    "text": {"x": 0.5, "y": 1.5, "w": 3.5, "h": 3.5},
                    "chart": {"x": 4.5, "y": 1.5, "w": 5, "h": 3.5}
                },
                "design_elements": [
                    {"type": "accent_bar", "position": "left", "color": "primary"},
                    {"type": "icon", "position": "top_left"}
                ]
            }
        """
        
        prompt = self._create_layout_prompt(slide_content, slide_context)
        try:
            response = await self.llm_client.generate(
                system_prompt=self._get_system_prompt(),
                user_prompt=prompt,
                temperature=0.7,
                response_format="json"
            )
        except Exception as exc:
            response = {"error": str(exc)}

        return self._validate_and_enhance_layout(response, slide_content, slide_context)
    
    def _get_system_prompt(self) -> str:
        return """You are an expert Layout Designer AI for presentations, like Canva or Beautiful.ai.

Your job is to analyze slide content and decide the BEST visual layout and design.
Always respect the slide content_type and any chart constraints.

LAYOUT CATEGORIES (choose from the right category first, then pick specific layout):

TEXT-FOCUSED:
- single_column_text: Title + centered bullet points (3-5 items)
- items: General-purpose items (1-6)
- steps: Sequential steps (3-5)
- summary: Final summary (1-5)
- title_only: Big impactful title, full slide

DATA-FOCUSED:
- chart: Chart-only slide
- full_chart: Chart takes 80% of slide, minimal text
- two_column_text_chart: Text left, chart right
- table: Table-only slide
- big_number: Key numerical highlights (1-5)
- big_number_stats: Large numbers/metrics as visual focus
- concentric_circles: TAM/SAM/SOM concentric circles

COMPARISON:
- comparison: Two-item comparison
- split_comparison: Left vs Right detailed comparison

PROCESS / TIME:
- timeline: Chronological sequence (3-5)
- timeline_horizontal: Linear timeline across slide
- milestone: Key dates (3-5)
- funnel: Filtering/progression (3-5)
- pyramid: Hierarchical levels (1-5)
- cycle: Cyclical process (3-5)

FRAMEWORKS:
- swot: Strengths/Weaknesses/Opportunities/Threats
- pestel: Political/Economic/Social/Technological/Environmental/Legal

SPECIAL:
- title_cover: Normal title slide with subtitle
- quote: Single quote + author
- thanks: Closing thank you slide
- three_column_cards: Three equal cards/sections

WITH ILLUSTRATION (use when visual_intent=true):
- text_left_illustration_right: Text column left + illustration right
- big_number_with_hero_image: Big metrics left + hero illustration right
- timeline_with_backdrop: Timeline left + contextual illustration right
- comparison_with_center_visual: Two comparison panels with bridge illustration in centre
- text_chart_micro_illustration: Text + chart with small illustration near title

DECISION TREE (follow in order):
1. Is it a title/closing? → title_cover / thanks
2. Is it a known framework (SWOT/PESTEL)? → Use that framework layout
3. Is content_type "chart" or must_render_chart true? → full_chart (if text is minimal) or two_column_text_chart
4. Does it have a chart? → full_chart (if text is minimal) or two_column_text_chart
4. Is it showing numbers/metrics? → big_number or big_number_stats
5. Is it a timeline/process? → timeline, steps, or milestone
6. Is it a comparison? → comparison or split_comparison
8. Does it have visual_intent=true? → Consider illustration variants
9. 6+ items? → three_column_cards or items
10. Default: single_column_text or items

VISUAL HIERARCHY:
- Decide what is the primary focus (chart, text, image, number)
- Calculate exact positions and sizes
- Add visual elements (accent bars, icons, lines)

SPACING RULES:
- 0.5" minimum margins
- 0.3" padding between elements
- Title always top, 0.5" from top
- Charts need 4-6" width minimum for readability
- Text blocks max 4" wide for readability

Always respond with valid JSON with exact measurements and positions."""

    def _create_layout_prompt(
        self,
        slide_content: Dict[str, Any],
        slide_context: Dict[str, Any]
    ) -> str:
        title = slide_content.get('title', '')
        content_items = slide_content.get('content', [])
        content_type = str(slide_content.get('content_type', '') or '')
        constraints = slide_content.get('constraints') if isinstance(slide_content.get('constraints'), dict) else {}
        must_render_chart = bool(constraints.get('must_render_chart')) if isinstance(constraints, dict) else False
        has_chart = bool(slide_content.get('chart')) or content_type == "chart" or must_render_chart
        slide_number = slide_content.get('slide_number', 0)
        total_slides = slide_context.get('total_slides', 10)
        
        prompt = f"""Decide the optimal layout for this slide:

SLIDE CONTENT:
Title: {title}
Content type: {content_type}
Number of content points: {len(content_items)}
Has chart: {has_chart}
Content items:
{chr(10).join(f'- {item}' for item in content_items[:5])}

CONTEXT:
Slide {slide_number} of {total_slides}
Is title slide: {slide_number == 1}
Is conclusion: {slide_number == total_slides}

"""
        guidelines = slide_context.get('design_guidelines')
        if guidelines:
            prompt += f"""DECK GUIDELINES (soft, follow as much as possible):
{guidelines}

"""
        
        if slide_content.get('chart'):
            chart_type = slide_content['chart'].get('chart_spec', {}).get('chart_type', 'bar')
            data_points = len(slide_content['chart'].get('chart_spec', {}).get('data', []))
            prompt += f"""
CHART INFO:
Type: {chart_type}
Data points: {data_points}
"""
        elif has_chart:
            prompt += "\nCHART INFO:\nType: planned (not generated yet)\nData points: unknown\n"
        if content_type:
            prompt += f"\nCONTENT TYPE CONSTRAINT:\n- content_type: {content_type}\n"
        if isinstance(constraints, dict) and constraints:
            prompt += f"- must_render_chart: {must_render_chart}\n"
            allowed = constraints.get("allowed_chart_types") or []
            if allowed:
                prompt += f"- allowed_chart_types: {', '.join(str(a) for a in allowed)}\n"
        
        prompt += """
TASK:
1. Choose the best layout_type from the available options
2. Decide visual hierarchy (what's most important)
3. Calculate exact positions for all elements
4. Add design elements (accent bars, icons, etc.)
5. Ensure professional spacing and alignment

Return JSON with complete layout specification including exact measurements in inches."""
        
        return prompt
    
    def _validate_and_enhance_layout(
        self,
        layout: Dict[str, Any],
        slide_content: Dict[str, Any],
        slide_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate layout and add missing details"""
        
        # Ensure required fields
        if 'layout_type' not in layout:
            layout['layout_type'] = self._fallback_layout_type(slide_content, slide_context)
        else:
            layout['layout_type'] = self._normalize_layout_type(
                layout['layout_type'],
                slide_content,
                slide_context
            )

        if 'element_positions' not in layout:
            layout['element_positions'] = self._get_default_positions(
                layout['layout_type']
            )

        if 'slide_number' not in layout:
            layout['slide_number'] = slide_content.get('slide_number')

        if 'visual_hierarchy' not in layout:
            layout['visual_hierarchy'] = {
                'primary_focus': 'text',
                'secondary_focus': 'title'
            }

        if 'design_elements' not in layout:
            layout['design_elements'] = []
        elif isinstance(layout['design_elements'], str):
            layout['design_elements'] = []
        elif isinstance(layout['design_elements'], dict):
            layout['design_elements'] = [layout['design_elements']]
        elif not isinstance(layout['design_elements'], list):
            layout['design_elements'] = []

        return layout

    def _normalize_layout_type(
        self,
        layout_type: Any,
        slide_content: Dict[str, Any],
        slide_context: Dict[str, Any]
    ) -> str:
        """Normalize layout type to one supported by the renderer."""
        supported = {
            'title_only',
            'single_column_text',
            'two_column_text_chart',
            'full_chart',
            'three_column_cards',
            'split_comparison',
            'big_number_stats',
            'timeline_horizontal',
            'items',
            'steps',
            'summary',
            'comparison',
            'big_number',
            'milestone',
            'pestel',
            'swot',
            'pyramid',
            'timeline',
            'funnel',
            'quote',
            'cycle',
            'thanks',
            'chart',
            'table',
            'concentric_circles',
            'title_cover',
            'text_left_illustration_right',
            'big_number_with_hero_image',
            'timeline_with_backdrop',
            'comparison_with_center_visual',
            'text_chart_micro_illustration',
        }

        if isinstance(layout_type, str) and layout_type in supported:
            return layout_type

        return self._fallback_layout_type(slide_content, slide_context)

    def _fallback_layout_type(
        self,
        slide_content: Dict[str, Any],
        slide_context: Dict[str, Any]
    ) -> str:
        """Choose a safe layout when AI output is missing or unsupported."""
        content_type = slide_content.get('content_type', 'text')
        has_chart = bool(slide_content.get('chart'))
        num_items = len(slide_content.get('content', []))
        is_title = slide_content.get('slide_number', 0) == 1

        if is_title or content_type == 'title':
            return 'title_cover'
        if content_type == 'summary':
            return 'summary'
        if content_type == 'quote':
            return 'quote'
        if content_type == 'thanks':
            return 'thanks'
        if content_type == 'pestel':
            return 'pestel'
        if content_type == 'swot':
            return 'swot'
        if content_type == 'pyramid':
            return 'pyramid'
        if content_type == 'funnel':
            return 'funnel'
        if content_type == 'cycle':
            return 'cycle'
        if content_type == 'steps':
            return 'steps'
        if content_type == 'items':
            return 'items'
        if content_type == 'big_number':
            return 'big_number'
        if content_type == 'milestone':
            return 'milestone'
        if content_type == 'chart':
            return 'chart'
        if content_type == 'table':
            return 'table'
        if content_type == 'concentric_circles':
            return 'concentric_circles'
        if content_type == 'timeline':
            return 'timeline'
        if content_type == 'comparison':
            return 'comparison'
        if has_chart:
            return 'full_chart' if num_items <= 1 else 'two_column_text_chart'
        if content_type == 'conclusion' or num_items <= 2:
            return 'big_number_stats' if num_items else 'single_column_text'
        if num_items >= 5:
            return 'three_column_cards'
        return 'single_column_text'
    
    def _get_default_positions(self, layout_type: str) -> Dict[str, Dict]:
        """Get default element positions for each layout type"""
        
        defaults = {
            'single_column_text': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'content': {'x': 1.5, 'y': 1.8, 'w': 7, 'h': 3.5}
            },
            'two_column_text_chart': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'content': {'x': 0.5, 'y': 1.5, 'w': 4, 'h': 3.5},
                'chart': {'x': 5, 'y': 1.5, 'w': 4.5, 'h': 3.5}
            },
            'full_chart': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'chart': {'x': 1, 'y': 1.3, 'w': 8, 'h': 3.8}
            },
            'chart': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'chart': {'x': 1, 'y': 1.3, 'w': 8, 'h': 3.8}
            },
            'table': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'table': {'x': 1, 'y': 1.3, 'w': 8, 'h': 3.8}
            },
            'concentric_circles': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'circles': {'x': 1.5, 'y': 1.2, 'w': 7, 'h': 3.9}
            },
            'title_cover': {
                'title': {'x': 0.8, 'y': 1.6, 'w': 8.4, 'h': 1.2},
                'subtitle': {'x': 0.8, 'y': 3.0, 'w': 8.0, 'h': 0.6}
            },
            'three_column_cards': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'card1': {'x': 0.5, 'y': 1.5, 'w': 2.8, 'h': 3},
                'card2': {'x': 3.6, 'y': 1.5, 'w': 2.8, 'h': 3},
                'card3': {'x': 6.7, 'y': 1.5, 'w': 2.8, 'h': 3}
            },
            'split_comparison': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'left_section': {'x': 0.5, 'y': 1.5, 'w': 4.5, 'h': 3.5},
                'right_section': {'x': 5.3, 'y': 1.5, 'w': 4.5, 'h': 3.5},
                'divider': {'x': 5, 'y': 1.5, 'w': 0.05, 'h': 3.5}
            },
            'big_number_stats': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'stat1': {'x': 0.5, 'y': 1.5, 'w': 3, 'h': 1.5},
                'stat2': {'x': 3.8, 'y': 1.5, 'w': 3, 'h': 1.5},
                'stat3': {'x': 7.1, 'y': 1.5, 'w': 3, 'h': 1.5},
                'description': {'x': 0.5, 'y': 3.3, 'w': 9, 'h': 1.5}
            },
            # ---- Illustration-variant layouts ----
            'text_left_illustration_right': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'content': {'x': 0.5, 'y': 1.5, 'w': 5.5, 'h': 3.5},
                'illustration': {'x': 6.5, 'y': 1.5, 'w': 3.0, 'h': 3.5},
            },
            'big_number_with_hero_image': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.6},
                'stat1': {'x': 0.5, 'y': 1.3, 'w': 5.5, 'h': 1.2},
                'stat2': {'x': 0.5, 'y': 2.7, 'w': 5.5, 'h': 1.2},
                'description': {'x': 0.5, 'y': 4.1, 'w': 5.5, 'h': 0.8},
                'illustration': {'x': 6.5, 'y': 1.3, 'w': 3.0, 'h': 3.0},
            },
            'timeline_with_backdrop': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'content': {'x': 0.5, 'y': 1.6, 'w': 6.5, 'h': 3.2},
                'illustration': {'x': 7.3, 'y': 1.6, 'w': 2.2, 'h': 3.2},
            },
            'comparison_with_center_visual': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 9, 'h': 0.8},
                'left_section': {'x': 0.5, 'y': 1.5, 'w': 3.2, 'h': 3.5},
                'illustration': {'x': 3.9, 'y': 1.8, 'w': 2.2, 'h': 2.8},
                'right_section': {'x': 6.3, 'y': 1.5, 'w': 3.2, 'h': 3.5},
            },
            'text_chart_micro_illustration': {
                'title': {'x': 0.5, 'y': 0.5, 'w': 7.8, 'h': 0.8},
                'content': {'x': 0.5, 'y': 1.5, 'w': 4, 'h': 3.5},
                'chart': {'x': 5, 'y': 1.5, 'w': 4.5, 'h': 3.5},
                'illustration': {'x': 8.3, 'y': 0.4, 'w': 1.2, 'h': 1.0},
            },
        }
        
        return defaults.get(layout_type, defaults['single_column_text'])


class VisualElementGenerator:
    """
    Generates visual design elements (icons, accent bars, shapes)
    """
    
    @staticmethod
    def generate_accent_bar(color: tuple, position: str, size: tuple) -> Dict:
        """Generate accent bar specification"""
        return {
            'type': 'rectangle',
            'fill_color': color,
            'line_width': 0,
            'position': position,
            'size': size
        }
    
    @staticmethod
    def generate_icon_placeholder(icon_type: str, position: tuple, size: float) -> Dict:
        """Generate icon specification"""
        return {
            'type': 'icon',
            'icon_name': icon_type,
            'position': position,
            'size': size
        }
    
    @staticmethod
    def generate_decorative_shape(shape_type: str, color: tuple, position: tuple) -> Dict:
        """Generate decorative shape"""
        return {
            'type': 'shape',
            'shape_type': shape_type,
            'color': color,
            'position': position
        }
