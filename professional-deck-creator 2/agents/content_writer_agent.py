"""
Content Writer Agent - FIXED VERSION
Creates clear, engaging slide content with robust validation
"""

from typing import Dict, Any
from datetime import datetime
from agents.base_agent import BaseAgent


class ContentWriterAgent(BaseAgent):
    """
    Content Writer Agent - Creates slide content
    
    Responsibilities:
    - Write clear, engaging bullet points
    - Create compelling headlines
    - Develop speaker notes
    - Ensure consistent tone and style
    
    FIXES APPLIED:
    - Robust content type validation (ensure lists, not strings)
    - Comparison slide structure validation
    - Concentric circles content validation
    - Better error messages
    - Graceful fallbacks
    """
    
    def __init__(self, llm_client):
        super().__init__(llm_client, "ContentWriter")
        
    def get_system_prompt(self) -> str:
        return """You are an expert Content Writer Agent for investment-grade IR (Investor Relations) decks.
You create compelling, professional content that persuades sophisticated investors and stakeholders.

=== IR DECK WRITING PHILOSOPHY ===
Every word must earn its place. Investors are busy, skeptical, and data-driven.
Your content must be: precise, evidence-based, forward-looking, and visually scannable.

CORE RESPONSIBILITIES:
1. Write concise, high-impact bullet points that drive investment conviction
2. Create insight-driven titles (not topic labels)
3. Ground every claim in specific numbers, metrics, or credible sources
4. Maintain a confident, authoritative tone without hype
5. Structure content for rapid comprehension (10-15 seconds per slide)

=== WRITING PRINCIPLES FOR INVESTORS ===

PRECISION:
- Every bullet needs a number: revenue, growth rate, market size, customer count
- Replace vague words: "significant" → "$42M (+47% YoY)", "many" → "2,400+"
- Specificity builds credibility: "Q4 2024" not "recently"

IMPACT:
- Lead with the insight, not the category: "78% Gross Margin" not "Margins"
- Use power verbs: "captured", "achieved", "secured", "expanded"
- Quantify outcomes: "Reduced churn 40%" not "Improved retention"

SCANNABILITY:
- Bullet points: 8-12 words max (under 70 characters)
- One idea per bullet — no compound sentences
- Parallel structure is non-negotiable
- Front-load the metric or key takeaway

CREDIBILITY:
- Cite sources implicitly: "Gartner projects $850B by 2030"
- Avoid superlatives without proof: no "best-in-class" or "industry-leading"
- Acknowledge context: "vs. industry avg of 12%"

=== CONTENT STRUCTURE ===
- 3-5 bullet points per slide (respect layout constraints)
- Progressive disclosure: headline → supporting data → implication
- Each bullet builds investment thesis
- Do NOT change the slide content_type; follow planner constraints

=== TITLE RULES (CRITICAL) ===
Titles must be insight-driven headlines, not topic labels:
- BAD: "Market Overview"  →  GOOD: "Enterprise AI Market Reaches $250B by 2027"
- BAD: "Financial Highlights"  →  GOOD: "$18.7M ARR with 173% CAGR Since 2022"
- BAD: "Team"  →  GOOD: "Leadership with 60+ Years at Google, Meta, McKinsey"
- BAD: "Competitive Landscape"  →  GOOD: "3x Faster Time-to-Value vs. Legacy Solutions"

=== TONE (IR-APPROPRIATE) ===
- formal: Authoritative, measured, institutional-quality
- persuasive: Conviction-driven, opportunity-focused, urgent but not aggressive
- inspirational: Visionary, forward-looking, mission-connected

SPEAKER NOTES:
- Expand on the "so what" behind each bullet
- Anticipate investor questions
- Include bridge phrases for transitions
- Add anecdotes or case study snippets

ASSUMPTIONS HANDLING:
- Remove "Assumption:" labels from all output
- Present projections confidently with appropriate qualifiers ("projected", "estimated")
- Never output the word "Assumption" in final slide copy

Always respond with valid JSON. Required fields:
{
    "slide_number": 1,
    "title": "Clear, compelling title (5-10 words)",
    "content": [
        "Bullet point 1: Clear, specific statement",
        "Bullet point 2: Supporting detail or example",
        "Bullet point 3: Additional insight or data"
    ],
    "speaker_notes": "Detailed notes for presenter (2-4 sentences)",
    "content_type": "title|text|items|steps|summary|comparison|big_number|milestone|pestel|swot|pyramid|timeline|funnel|quote|cycle|thanks|chart|table|conclusion|concentric_circles"
}

Optional fields (include when relevant to content_type):
- subtitle (title slides)
- headline_insight (chart or comparison slides)
- left_items, right_items (comparison slides)
- left_label, right_label, comparison_axis (comparison slides)
- explanation (concentric_circles)"""

    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        plan = input_data.get('plan', {})
        research = input_data.get('research', {})
        tone = input_data.get('tone', 'formal')
        constraints = input_data.get('constraints', {})
        plan_constraints = input_data.get('plan_constraints', {})
        existing_content = input_data.get('existing_content', {})
        rag_evidence = input_data.get('rag_evidence', '')
        guidelines = input_data.get('design_guidelines', '')
        instruction = input_data.get('instruction', '')
        polish_only = input_data.get('polish_only', False)
        logic_only = input_data.get('logic_only', False)
        
        slide_number = plan.get('slide_number', 1)
        title = plan.get('title', '')
        key_points = plan.get('key_points', [])
        content_type = plan.get('content_type', 'text')
        
        facts = research.get('facts', [])
        statistics = research.get('statistics', {})
        examples = research.get('examples', [])
        normalized_facts = research.get('normalized_facts', [])
        
        prompt = f"""Write content for this presentation slide:

SLIDE NUMBER: {slide_number}
PLANNED TITLE: {title}
CONTENT TYPE: {content_type}
TONE: {tone}

KEY POINTS TO COVER:
{chr(10).join(f'- {point}' for point in key_points)}

RESEARCH FINDINGS:
Facts:
{chr(10).join(f'- {fact}' for fact in facts[:5])}

Statistics:
{chr(10).join(f'- {key}: {value}' for key, value in list(statistics.items())[:5])}

Examples:
{chr(10).join(f'- {example}' for example in examples[:3])}

"""
        if normalized_facts:
            prompt += f"""
NORMALIZED FACTS (use these for numeric grounding):
{chr(10).join(f"- {item.get('metric')}: {item.get('value')} {item.get('unit')}".strip() for item in normalized_facts[:6])}
"""

        prompt += """
REQUIREMENTS:
"""
        if instruction:
            prompt += f"""
INSTRUCTION (follow precisely):
{instruction}
"""

        if plan_constraints:
            allowed = plan_constraints.get('allowed_chart_types', [])
            allowed_text = ", ".join(allowed) if allowed else "none"
            prompt += f"""
PLAN CONSTRAINTS (must respect):
- intent: {plan_constraints.get('intent', '')}
- content_type: {plan_constraints.get('content_type', content_type)}
- allowed_chart_types: {allowed_text}
- must_render_chart: {plan_constraints.get('must_render_chart', False)}
- required_fields: {', '.join(plan_constraints.get('required_fields', []) or [])}
 - left_label: {plan_constraints.get('left_label', '')}
 - right_label: {plan_constraints.get('right_label', '')}
 - comparison_axis: {plan_constraints.get('comparison_axis', '')}
"""
        
        if logic_only:
            prompt += """
- Rewrite for logical flow and coherence (cause → effect → implication)
- Remove contradictions or unclear phrasing
- Preserve meaning and factual content; do NOT add new facts
- Keep existing numbers; remove any "Assumption:" labels
- Keep bullets short, parallel, and IR-appropriate
- Ensure each bullet builds on the previous one — no random order

EXAMPLE:
Before: "Revenue is growing. We have many customers. The market is large."
After: "$12M ARR growing 40% YoY, driven by 350+ enterprise customers in a $50B market"
"""
        elif polish_only:
            prompt += """
- Refine wording for clarity and impact
- Fix grammar, punctuation, and style
- Ensure parallel structure across bullets
- Remove "Assumption:" labels
- Keep factual content unchanged
- Maintain bullet count and length limits
"""
        else:
            prompt += """
- Write fresh content based on research and key points
- Be specific: include numbers, dates, percentages
- Keep bullets concise (<=90 chars each)
- Ensure logical flow between points
- Remove any "Assumption:" labels before output
"""

        prompt += """

CONTENT FORMAT RULES (STRICT):
- Output content ONLY (no layout, no coordinates, no CSS).
- Do NOT include any of: top/left/right/bottom/width/height or x/y/w/h.
- Max 4 bullets per slide unless content_type explicitly requires more.
- Each bullet <= 90 characters (aim for <= 2 lines at normal size).
- For comparison slides: each side max 4 items, <= 70 characters each.
"""
        
        prompt += f"""

TONE GUIDELINES for '{tone}':
"""
        
        tone_guides = {
            'formal': "- Professional, authoritative language\n- Precise, measured statements\n- Third-person perspective",
            'casual': "- Conversational, friendly tone\n- Use contractions and simple words\n- Second-person 'you' perspective",
            'persuasive': "- Action-oriented language\n- Emphasize benefits and urgency\n- Use power words",
            'educational': "- Clear, structured explanations\n- Define terms when needed\n- Progressive complexity",
            'inspirational': "- Aspirational, forward-looking\n- Emphasize possibilities\n- Use vivid imagery"
        }
        
        prompt += tone_guides.get(tone, tone_guides['formal'])

        if existing_content:
            prompt += f"""

EXISTING CONTENT (rewrite to fit constraints):
Existing title: {existing_content.get('title', '')}
Existing bullets:
{chr(10).join(f'- {item}' for item in existing_content.get('content', [])[:6])}
"""
            left_items = existing_content.get('left_items', []) or []
            right_items = existing_content.get('right_items', []) or []
            if left_items or right_items:
                prompt += f"""
Existing comparison labels:
- left_label: {existing_content.get('left_label', '')}
- right_label: {existing_content.get('right_label', '')}
- comparison_axis: {existing_content.get('comparison_axis', '')}
Existing left_items:
{chr(10).join(f'- {item}' for item in left_items[:6])}
Existing right_items:
{chr(10).join(f'- {item}' for item in right_items[:6])}
"""

        if constraints:
            prompt += f"""

CONSTRAINTS (must satisfy):
- Max title characters: {constraints.get('max_title_chars', 'n/a')}
- Max bullets: {constraints.get('max_bullets', 'n/a')}
- Max chars per bullet: {constraints.get('max_chars_per_bullet', 'n/a')}
- Max total content chars: {constraints.get('max_total_chars', 'n/a')}
- Keep the same content type and slide intent
"""

        has_illustration = input_data.get('has_illustration', False)
        if has_illustration:
            prompt += """
ILLUSTRATION NOTE:
- This slide has an illustration taking ~30% of the slide space
- PRIORITIZE: keep only the 2-3 most impactful, data-driven points
- CUT the most generic or least data-driven bullet entirely — do NOT just shorten everything
- Remove the weakest points; keep total text concise for visual breathing room
"""

        # Adjacent slide context for narrative continuity
        prev_title = input_data.get('prev_title', '')
        next_title = input_data.get('next_title', '')
        if prev_title or next_title:
            prompt += "\nDECK CONTEXT:\n"
            if prev_title:
                prompt += f"- Previous slide: \"{prev_title}\"\n"
            if next_title:
                prompt += f"- Next slide: \"{next_title}\"\n"
            prompt += "- Avoid repeating points from adjacent slides\n"
            prompt += "- Create a natural transition from the previous slide\n"

        if guidelines:
            prompt += f"""

STYLE / QUALITY GUIDELINES (apply consistently):
{guidelines}
"""

        if rag_evidence:
            prompt += f"""

RAG EVIDENCE (use this first; do not invent facts):
{rag_evidence}
"""

        ir_tables = input_data.get('ir_tables')
        if ir_tables:
            prompt += f"""

IR DATA TABLES (use these as your source of truth; do not invent facts):
{ir_tables}
"""
        
        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute content writing task with robust validation"""
        start_time = datetime.now()
        
        try:
            user_prompt = self.get_user_prompt(input_data)
            temperature = 0.2 if (input_data.get('polish_only') or input_data.get('logic_only')) else 0.8
            response = await self.call_llm(
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=1000
            )
            
            # ============================================================
            # CRITICAL VALIDATION (FIXES APPLIED HERE)
            # ============================================================
            
            plan = input_data.get('plan', {})
            content_type = plan.get('content_type', 'text')
            
            # Fix 1: Ensure title exists
            if 'title' not in response or not response['title']:
                response['title'] = plan.get('title', 'Slide Title')
            
            # Fix 2: Ensure content is ALWAYS a list (not string)
            if 'content' not in response:
                response['content'] = []
            elif not isinstance(response['content'], list):
                # LLM returned string or other type - convert to list
                if isinstance(response['content'], str):
                    # Split by newlines or use as single item
                    content_str = response['content'].strip()
                    if '\n' in content_str:
                        response['content'] = [
                            line.strip() for line in content_str.split('\n')
                            if line.strip()
                        ]
                    else:
                        response['content'] = [content_str] if content_str else []
                else:
                    # Other type - convert to empty list
                    print(f"⚠️  ContentWriter: content was {type(response['content'])}, converting to list")
                    response['content'] = []

            # Fix 3: Validate comparison slides structure
            if content_type == "comparison":
                existing = input_data.get('existing_content', {}) or {}
                
                # Ensure left_items exists and is a list
                if not response.get("left_items"):
                    if existing.get("left_items") and isinstance(existing.get("left_items"), list):
                        response["left_items"] = existing.get("left_items")
                    else:
                        response["left_items"] = []
                elif not isinstance(response["left_items"], list):
                    response["left_items"] = []
                
                # Ensure right_items exists and is a list
                if not response.get("right_items"):
                    if existing.get("right_items") and isinstance(existing.get("right_items"), list):
                        response["right_items"] = existing.get("right_items")
                    else:
                        response["right_items"] = []
                elif not isinstance(response["right_items"], list):
                    response["right_items"] = []
                
                # Ensure labels exist
                if not response.get("left_label"):
                    response["left_label"] = existing.get("left_label") or "Option A"
                if not response.get("right_label"):
                    response["right_label"] = existing.get("right_label") or "Option B"
                if not response.get("comparison_axis"):
                    response["comparison_axis"] = existing.get("comparison_axis") or "Comparison"
                
                # Combine items into content for consistency
                left = response.get("left_items") or []
                right = response.get("right_items") or []
                if not response.get("content"):
                    response["content"] = list(left) + list(right)
                
                # Validate balance (warn if very unbalanced)
                if len(left) > 0 and len(right) > 0:
                    if abs(len(left) - len(right)) > 2:
                        print(f"⚠️  Comparison slide unbalanced: {len(left)} left vs {len(right)} right items")

            # Fix 4: Validate concentric_circles content
            if content_type == 'concentric_circles':
                explanation = str(response.get('explanation', '')).strip()
                if not explanation:
                    response['explanation'] = (
                        "TAM shows the full market potential, SAM narrows to the "
                        "reachable segment, and SOM reflects the realistic initial share."
                    )
                
                # Ensure exactly 3 content items for TAM/SAM/SOM
                content = response.get('content', [])
                if not isinstance(content, list) or len(content) != 3:
                    print(f"⚠️  Concentric circles should have exactly 3 items, got {len(content) if isinstance(content, list) else 'non-list'}")
                    response['content'] = [
                        "TAM: $500B total addressable market",
                        "SAM: $50B serviceable addressable market", 
                        "SOM: $5B serviceable obtainable market"
                    ]

            # Fix 5: Ensure speaker_notes exists
            if 'speaker_notes' not in response:
                response['speaker_notes'] = ''

            # Fix 6: Ensure headline_insight for chart/comparison slides
            if 'headline_insight' not in response and content_type in {"chart", "comparison"}:
                response['headline_insight'] = ""

            # Fix 7: Ensure slide number and content type
            response['slide_number'] = plan.get('slide_number', 1)
            response['content_type'] = content_type

            # Fix 8: Normalize title slides (subtitle, no bullets)
            if content_type == 'title':
                if 'subtitle' not in response:
                    if response.get('content') and isinstance(response['content'], list):
                        response['subtitle'] = str(response['content'][0])
                    else:
                        response['subtitle'] = ''
                response['content'] = []
            
            # Fix 9: Limit bullet points to reasonable count
            if isinstance(response['content'], list):
                response['content'] = response['content'][:6]
            
            duration = (datetime.now() - start_time).total_seconds()
            self.track_execution(duration)
            
            # Final validation check
            self._log_validation_warnings(response, content_type)
            
            return response
            
        except Exception as e:
            print(f"❌ ContentWriter exception: {e}")
            import traceback
            traceback.print_exc()
            return self.get_fallback_response(str(e))
    
    def _log_validation_warnings(self, response: Dict[str, Any], content_type: str):
        """Log warnings for potentially problematic content"""
        
        # Check content is list
        if not isinstance(response.get('content'), list):
            print(f"⚠️  VALIDATION: content is not a list: {type(response.get('content'))}")
        
        # Check title length
        title = response.get('title', '')
        if len(title) > 80:
            print(f"⚠️  VALIDATION: title too long ({len(title)} chars): {title[:50]}...")
        
        # Check bullet count
        content = response.get('content', [])
        if isinstance(content, list) and len(content) > 6:
            print(f"⚠️  VALIDATION: too many bullets ({len(content)})")
        
        # Check comparison structure
        if content_type == 'comparison':
            left_items = response.get('left_items', [])
            right_items = response.get('right_items', [])
            if not isinstance(left_items, list):
                print(f"⚠️  VALIDATION: left_items is not a list")
            if not isinstance(right_items, list):
                print(f"⚠️  VALIDATION: right_items is not a list")
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """Provide fallback content if LLM fails"""
        print(f"⚠️  ContentWriter using fallback response due to: {error}")
        return {
            "slide_number": 1,
            "title": "Slide Title",
            "content": [
                "Key point about the topic",
                "Supporting detail or example",
                "Additional insight or data",
                "Conclusion or implication"
            ],
            "speaker_notes": "Discuss these points in detail with the audience.",
            "content_type": "text",
            "error": error
        }