"""
Reviewer Agent
Ensures presentation quality and consistency
"""

from typing import Dict, Any, List
from datetime import datetime
from .base_agent import BaseAgent


class ReviewerAgent(BaseAgent):
    """
    Reviewer Agent - Quality assurance
    
    Responsibilities:
    - Review content quality
    - Check design consistency
    - Verify data accuracy
    - Suggest improvements
    - Generate quality reports
    """
    
    def __init__(self, llm_client):
        super().__init__(llm_client, "Reviewer")
        
    def get_system_prompt(self) -> str:
        return """You are an expert Quality Assurance Agent specialized in reviewing
presentations for excellence, clarity, and impact.

CORE RESPONSIBILITIES:
1. Review content quality and clarity
2. Check design consistency
3. Verify logical flow
4. Identify areas for improvement
5. Generate quality scores
6. Check cross-slide consistency

REVIEW CRITERIA:

CONTENT QUALITY (30%):
- Clear, concise messaging
- Accurate information with specific numbers (not vague claims)
- Engaging language
- Appropriate tone
- No typos or errors

DESIGN CONSISTENCY (25%):
- Unified visual style
- Proper color usage
- Consistent fonts and sizing
- Adequate whitespace
- Good visual hierarchy

NARRATIVE FLOW (20%):
- Logical progression (problem, solution, proof, ask)
- Smooth transitions
- Compelling story arc
- Strong opening and closing

DATA VISUALIZATION (15%):
- Appropriate chart types
- Clear, readable charts
- Accurate data representation
- Effective use of visuals

OVERALL IMPACT (10%):
- Memorable and engaging
- Achieves intended purpose
- Professional appearance
- Audience-appropriate

CONSISTENCY CHECKS:
- Numbers mentioned on one slide must match if referenced elsewhere
- Terminology should be consistent (do not call it "platform" on one slide and "product" on another)
- If a metric is introduced, it should be explained or contextualized

SCORING:
- 9-10: Exceptional, minimal improvements needed
- 7-8: Very good, minor refinements suggested
- 5-6: Good, several improvements recommended
- 3-4: Needs significant work
- 1-2: Major issues, requires revision

Always respond with valid JSON in this exact format:
{
    "overall_score": 8.5,
    "category_scores": {
        "content": 9.0,
        "design": 8.0,
        "flow": 8.5,
        "data_viz": 8.0,
        "impact": 9.0
    },
    "strengths": [
        "Clear, compelling narrative",
        "Professional design system",
        "Effective data visualizations"
    ],
    "improvements": [
        {
            "slide_number": 3,
            "issue": "Bullet points too long",
            "suggestion": "Condense to 1-2 lines each",
            "priority": "high",
            "fixable": true
        }
    ],
    "needs_revision": false,
    "summary": "Overall assessment and recommendations"
}"""

    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        presentation = input_data.get('presentation', {})
        slides = presentation.get('slides', [])
        design_system = presentation.get('design_system', {})
        
        # Create summary for review
        prompt = f"""Review this presentation for quality and provide detailed feedback:

NUMBER OF SLIDES: {len(slides)}
DESIGN STYLE: {design_system.get('style', 'professional')}

SLIDES OVERVIEW:
"""
        
        for i, slide in enumerate(slides):
            prompt += f"\nSlide {i+1}: {slide.get('title', 'Untitled')}\n"
            prompt += f"Type: {slide.get('content_type', 'text')}\n"

            content = slide.get('content', [])
            if content:
                prompt += f"Content ({len(content)} points): {'; '.join(str(c)[:60] for c in content[:4])}\n"

            if slide.get('chart'):
                prompt += "Has chart: Yes\n"
        
        prompt += f"""

DESIGN SYSTEM:
Colors: Primary={design_system.get('colors', {}).get('primary', 'N/A')}, 
        Secondary={design_system.get('colors', {}).get('secondary', 'N/A')}
Fonts: Title={design_system.get('fonts', {}).get('title', 'N/A')}, 
       Body={design_system.get('fonts', {}).get('body', 'N/A')}

REVIEW REQUIREMENTS:
1. Evaluate overall quality across all criteria
2. Review EVERY slide — identify specific slides that need improvement
3. Provide actionable suggestions with priority (high/medium/low)
4. Assign category scores and overall score
5. Determine if revision is needed
6. Check cross-slide consistency (numbers, terminology, narrative flow)

Focus on:
- Content clarity and engagement
- Design consistency and professionalism
- Logical flow and narrative arc
- Effective use of visuals
- Cross-slide consistency (same metric should match everywhere)
- Overall impact and memorability"""

        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute review task"""
        start_time = datetime.now()
        
        try:
            presentation = input_data.get('presentation', {})
            
            # Perform automated checks
            auto_check_results = self._automated_checks(presentation)
            
            # Get AI review
            user_prompt = self.get_user_prompt(input_data)
            ai_review = await self.call_llm(
                user_prompt=user_prompt,
                temperature=0.3,  # Lower for consistent evaluation
                max_tokens=1500
            )
            
            # Combine automated and AI reviews
            final_review = self._combine_reviews(auto_check_results, ai_review)
            
            # Apply minor improvements
            improved_presentation = self._apply_improvements(
                presentation,
                final_review.get('improvements', [])
            )
            
            duration = (datetime.now() - start_time).total_seconds()
            self.track_execution(duration)
            
            return {
                **improved_presentation,
                'quality_report': final_review,
                'reviewed_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            return self.get_fallback_response(str(e))
    
    def _automated_checks(self, presentation: Dict[str, Any]) -> Dict[str, Any]:
        """Perform automated quality checks"""
        slides = presentation.get('slides', [])
        issues = []
        
        for slide in slides:
            slide_num = slide.get('slide_number', 0)
            
            # Check title length
            title = slide.get('title', '')
            if len(title) > 80:
                issues.append({
                    'slide_number': slide_num,
                    'issue': 'Title too long',
                    'suggestion': 'Shorten to under 80 characters',
                    'priority': 'medium'
                })
            
            # Check bullet point count
            content = slide.get('content', [])
            if len(content) > 6:
                issues.append({
                    'slide_number': slide_num,
                    'issue': 'Too many bullet points',
                    'suggestion': 'Reduce to 5-6 points maximum',
                    'priority': 'high'
                })
            
            # Check bullet point length
            for i, point in enumerate(content):
                if isinstance(point, str) and len(point) > 150:
                    issues.append({
                        'slide_number': slide_num,
                        'issue': f'Bullet point {i+1} too long',
                        'suggestion': 'Condense to 1-2 lines (under 150 chars)',
                        'priority': 'medium'
                    })
        
        # Calculate basic score
        total_issues = len(issues)
        high_priority = sum(1 for i in issues if i['priority'] == 'high')
        
        base_score = 10.0 - (high_priority * 0.5) - ((total_issues - high_priority) * 0.2)
        base_score = max(5.0, min(10.0, base_score))
        
        return {
            'automated_score': base_score,
            'automated_issues': issues,
            'total_issues': total_issues
        }
    
    def _combine_reviews(
        self, 
        auto_review: Dict[str, Any], 
        ai_review: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Combine automated and AI reviews"""
        # Get scores
        auto_score = auto_review.get('automated_score', 7.0)
        ai_score = ai_review.get('overall_score', 8.0)
        
        # Weighted average (60% AI, 40% automated)
        combined_score = (ai_score * 0.6) + (auto_score * 0.4)
        
        # Combine issues
        all_improvements = (
            auto_review.get('automated_issues', []) +
            ai_review.get('improvements', [])
        )
        
        # Deduplicate by slide number
        seen_slides = set()
        unique_improvements = []
        for imp in all_improvements:
            slide_num = imp.get('slide_number', 0)
            if slide_num not in seen_slides:
                unique_improvements.append(imp)
                seen_slides.add(slide_num)
        
        return {
            'overall_score': round(combined_score, 1),
            'category_scores': ai_review.get('category_scores', {}),
            'strengths': ai_review.get('strengths', []),
            'improvements': unique_improvements[:10],  # Top 10
            'needs_revision': combined_score < 6.0,
            'summary': ai_review.get('summary', 'Review completed'),
            'automated_checks': {
                'total_issues': auto_review.get('total_issues', 0),
                'score': auto_score
            }
        }
    
    def _apply_improvements(
        self,
        presentation: Dict[str, Any],
        improvements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply automatic improvements where possible"""
        slides = presentation.get('slides', [])
        
        for improvement in improvements:
            slide_num = improvement.get('slide_number', 0)
            issue = improvement.get('issue', '')
            priority = improvement.get('priority', 'low')
            
            # Only apply high-priority automated fixes
            if priority != 'high':
                continue
            
            if slide_num > 0 and slide_num <= len(slides):
                slide = slides[slide_num - 1]
                
                # Fix: Too many bullet points
                if 'too many bullet points' in issue.lower():
                    content = slide.get('content', [])
                    if len(content) > 6:
                        slide['content'] = content[:6]
                
                # Fix: Bullet points too long
                if 'bullet point' in issue.lower() and 'too long' in issue.lower():
                    content = slide.get('content', [])
                    slide['content'] = [
                        (point[:147] + '...') if len(point) > 150 else point
                        for point in content
                        if isinstance(point, str)
                    ]
        
        return presentation
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """Provide fallback review if fails"""
        return {
            'slides': [],
            'quality_report': {
                'overall_score': 7.0,
                'category_scores': {
                    'content': 7.0,
                    'design': 7.0,
                    'flow': 7.0,
                    'data_viz': 7.0,
                    'impact': 7.0
                },
                'strengths': ['Presentation completed'],
                'improvements': [],
                'needs_revision': False,
                'summary': 'Review unavailable due to error',
                'error': error
            }
        }
