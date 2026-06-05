"""
Researcher Agent
Gathers accurate, relevant information for presentation content
"""

from typing import Dict, Any
from datetime import datetime
from .base_agent import BaseAgent


class ResearcherAgent(BaseAgent):
    """
    Research Agent - Gathers information for slides
    
    Responsibilities:
    - Research facts, statistics, and data points
    - Find relevant examples and case studies
    - Gather supporting evidence
    - Identify key trends and insights
    """
    
    def __init__(self, llm_client):
        super().__init__(llm_client, "Researcher")
        
    def get_system_prompt(self) -> str:
        return """You are an expert Research Agent specialized in gathering accurate,
relevant information for presentations.

CORE RESPONSIBILITIES:
1. Research facts, statistics, and data points
2. Find relevant examples, case studies, and real-world applications
3. Identify key trends and market insights
4. Gather quantitative data for visualizations
5. Provide credible, up-to-date information

RESEARCH PRINCIPLES:
- Focus on recent, relevant data (last 3-5 years)
- Include specific numbers, percentages, and metrics
- Provide context for statistics
- Identify key trends and patterns
- Find compelling examples

DATA GATHERING:
- For market/industry topics: market size, growth rates, key players
- For technology topics: adoption rates, capabilities, use cases
- For business topics: revenue, ROI, efficiency gains
- For social topics: demographics, surveys, impact metrics

HARD RULES:
- NEVER write "significant growth" or "rapid adoption" without a number
- Every fact MUST include at least one specific number, percentage, or date
- If you cannot find a specific number, write "Assumption: ~X%" and explain your reasoning (internal marker; final deck will remove the label)
- When using RAG evidence, cite the source index: e.g., "Market size: $250B [1]"
- When generating assumptions, always prefix with "Assumption:" (internal use only)

QUALITY STANDARDS:
- Specific numbers over vague statements — no exceptions
- Recent data over outdated information
- Multiple data points for charts (minimum 4)
- Clear, factual statements
- Actionable insights
- If sources are missing, create reasonable assumptions and label them as "Assumption" (internal use only)
- If no RAG evidence is provided, you MUST generate reasonable numeric assumptions for any needed charts
- Provide at least one clear insight headline for chart-heavy slides

Always respond with valid JSON in this exact format:
{
    "facts": [
        "Specific fact with numbers and context [source_index if from RAG]",
        "Another concrete fact or statistic"
    ],
    "statistics": {
        "market_size": "250B",
        "growth_rate": "25% CAGR",
        "key_metric_1": "value",
        "key_metric_2": "value"
    },
    "examples": [
        "Real-world example or case study"
    ],
    "trends": [
        "Key trend or insight"
    ],
    "chart_data": {
        "suggested": true,
        "chart_type": "bar|column|line|pie|doughnut|area",
        "data_points": [
            {"label": "2021", "value": 150},
            {"label": "2022", "value": 200},
            {"label": "2023", "value": 280},
            {"label": "2024", "value": 350},
            {"label": "2025", "value": 450}
        ]
    }
}"""

    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        slide = input_data.get('slide', {})
        instruction = input_data.get('instruction', '')
        depth = input_data.get('depth', 'moderate')
        topic = input_data.get('topic', '')
        rag_evidence = input_data.get('rag_evidence', '')
        
        title = slide.get('title', '')
        key_points = slide.get('key_points', [])
        content_type = slide.get('content_type', 'text')
        
        prompt = f"""Research information for this presentation slide:

OVERALL TOPIC: {topic}
SLIDE TITLE: {title}
CONTENT TYPE: {content_type}
KEY POINTS TO COVER: {', '.join(key_points)}

RESEARCH DEPTH: {depth}
"""
        if instruction:
            prompt += f"""
INSTRUCTION:
{instruction}
"""
        
        if depth == "deep":
            prompt += """
DEEP RESEARCH REQUIREMENTS:
- Provide 5-7 specific facts with numbers
- Include multiple statistics with sources
- Find 3+ concrete examples
- Identify 3-5 key trends
- Provide comprehensive data for charts
"""
        elif depth == "moderate":
            prompt += """
MODERATE RESEARCH REQUIREMENTS:
- Provide 3-5 key facts
- Include important statistics
- Find 1-2 good examples
- Identify 2-3 main trends
- Provide chart data if relevant
"""
        else:  # light
            prompt += """
LIGHT RESEARCH REQUIREMENTS:
- Provide 2-3 key facts
- Include 1-2 statistics
- Find 1 example
- Note main trend
"""
        
        # Determine if this slide is data-oriented (benefits from chart_data)
        data_keywords = {"market", "revenue", "growth", "trend", "sales", "metric",
                         "data", "performance", "rate", "share", "adoption", "size",
                         "cagr", "roi", "profit", "cost", "budget", "forecast",
                         "comparison", "benchmark", "kpi", "analysis", "statistic"}
        title_lower = title.lower()
        is_data_oriented = (
            content_type in {"chart", "big_number", "table", "comparison"}
            or any(kw in title_lower for kw in data_keywords)
        )

        if content_type == "chart":
            prompt += """

CHART DATA REQUIRED:
This slide needs a data visualization. Please provide:
- 4-6 data points with label/value pairs
- Suggested chart type (bar, column, line, pie, doughnut, or area)
- Clear trend or comparison
- Specific numbers (not ranges)
"""
        elif is_data_oriented:
            prompt += """

CHART DATA STRONGLY RECOMMENDED:
This slide has data-oriented content. Please provide chart_data with:
- 4-6 data points with label/value pairs
- Suggested chart type (bar, column, line, pie, doughnut, or area)
- Specific numbers — use reasonable assumptions if needed
This enables the system to render a chart visualization for this slide.
"""
        
        prompt += """

Focus on:
- Concrete numbers and percentages — every fact needs at least one number
- Recent data (last 3-5 years)
- Specific, actionable insights
- Clear, compelling facts
- If citing RAG evidence, include the source index [1], [2], etc."""

        if rag_evidence:
            prompt += f"""

RAG EVIDENCE (use this first; do not invent numbers):
{rag_evidence}
"""
        else:
            prompt += """

NO RAG EVIDENCE PROVIDED:
- You MUST provide reasonable numeric assumptions where data is required
- Clearly label assumed numbers as "Assumption" (internal use only)
"""
        
        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute research task"""
        start_time = datetime.now()
        
        try:
            user_prompt = self.get_user_prompt(input_data)
            response = await self.call_llm(
                user_prompt=user_prompt,
                temperature=0.5,  # Lower for factual accuracy
                max_tokens=1500
            )
            
            # Validate response
            if 'facts' not in response:
                response['facts'] = []
            
            if 'statistics' not in response:
                response['statistics'] = {}
            
            # Ensure chart data for data-oriented slides
            slide = input_data.get('slide', {})
            content_type = slide.get('content_type', 'text')
            title_lower = str(slide.get('title', '')).lower()
            data_keywords = {"market", "revenue", "growth", "trend", "sales", "metric",
                             "data", "performance", "rate", "share", "adoption", "size",
                             "cagr", "roi", "profit", "cost", "budget", "forecast",
                             "comparison", "benchmark", "kpi", "analysis", "statistic"}
            is_data_oriented = (
                content_type in {"chart", "big_number", "table", "comparison"}
                or any(kw in title_lower for kw in data_keywords)
            )
            if is_data_oriented and 'chart_data' not in response:
                response['chart_data'] = self._generate_fallback_chart_data(slide)
            
            duration = (datetime.now() - start_time).total_seconds()
            self.track_execution(duration)
            
            return response
            
        except Exception as e:
            return self.get_fallback_response(str(e))
    
    def _generate_fallback_chart_data(self, slide: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback chart data"""
        return {
            "suggested": True,
            "data_points": [
                {"label": "2020", "value": 100},
                {"label": "2021", "value": 150},
                {"label": "2022", "value": 200},
                {"label": "2023", "value": 280},
                {"label": "2024", "value": 350}
            ],
            "chart_type": "bar"
        }
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """Provide fallback research if LLM fails"""
        return {
            "facts": [
                "Assumption: Market size is ~$120B in 2024, growing to ~$180B by 2028",
                "Assumption: Adoption increased from ~20% in 2021 to ~45% in 2024",
                "Assumption: Top 5 players control ~55% market share in 2024"
            ],
            "statistics": {
                "market_size": "120B (2024 est.)",
                "growth_rate": "10–12% CAGR (2024–2028 est.)",
                "adoption_rate": "45% (2024 est.)"
            },
            "examples": [
                "Assumption: Three pilot deployments delivered ~18% cost reduction within 12 months"
            ],
            "trends": [
                "Assumption: Regulatory guidance expanded in 4 of 5 major regions since 2022",
                "Assumption: Average deployment timelines fell ~30% since 2021"
            ],
            "chart_data": {
                "suggested": True,
                "data_points": [
                    {"label": "2020", "value": 100},
                    {"label": "2021", "value": 150},
                    {"label": "2022", "value": 200},
                    {"label": "2023", "value": 280},
                    {"label": "2024", "value": 350}
                ],
                "chart_type": "bar"
            },
            "error": error
        }
