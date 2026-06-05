"""
Base Agent Class
All specialized agents inherit from this base class
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import asyncio


class BaseAgent(ABC):
    """
    Abstract base class for all AI agents
    Provides common functionality and interface
    """
    
    def __init__(self, llm_client, agent_name: str):
        self.llm_client = llm_client
        self.agent_name = agent_name
        self.is_ready = False
        self.execution_count = 0
        self.total_execution_time = 0.0
        
    async def initialize(self):
        """Initialize the agent"""
        self.is_ready = True
        
    async def cleanup(self):
        """Cleanup agent resources"""
        self.is_ready = False
        
    def is_healthy(self) -> bool:
        """Check if agent is healthy and ready"""
        return self.is_ready
    
    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent's main task
        Must be implemented by subclasses
        """
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """
        Get the system prompt for this agent
        Must be implemented by subclasses
        """
        pass
    
    @abstractmethod
    def get_user_prompt(self, input_data: Dict[str, Any]) -> str:
        """
        Generate user prompt from input data
        Must be implemented by subclasses
        """
        pass
    
    async def call_llm(
        self,
        user_prompt: str,
        system_prompt: Optional[str] = None,
        model_preference: str = "auto",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        Call LLM with proper error handling and retries
        """
        if system_prompt is None:
            system_prompt = self.get_system_prompt()
        
        try:
            response = await self.llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model_preference=model_preference,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format="json"
            )
            
            return response
            
        except Exception as e:
            # Log error and return fallback
            return self.get_fallback_response(str(e))
    
    def get_fallback_response(self, error: str) -> Dict[str, Any]:
        """
        Provide fallback response when LLM call fails
        Can be overridden by subclasses
        """
        return {
            "error": True,
            "message": f"{self.agent_name} failed",
            "details": error
        }
    
    def track_execution(self, duration: float):
        """Track execution metrics"""
        self.execution_count += 1
        self.total_execution_time += duration
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get agent performance metrics"""
        avg_time = (
            self.total_execution_time / self.execution_count
            if self.execution_count > 0
            else 0
        )
        
        return {
            "agent_name": self.agent_name,
            "execution_count": self.execution_count,
            "total_execution_time": self.total_execution_time,
            "average_execution_time": avg_time,
            "is_healthy": self.is_healthy()
        }
