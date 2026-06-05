"""
LLM Client - Unified interface for OpenAI and Gemini
Handles API calls, retries, and fallbacks
"""

import os
import json
import re
import asyncio
from typing import Dict, Any, Optional, Literal
from datetime import datetime
import aiohttp


def _repair_json(text: str) -> str:
    """Best-effort repair of common LLM JSON errors.

    Handles trailing commas, missing commas between entries,
    and truncated responses (unclosed braces/brackets).
    """
    s = text.strip()

    # Remove trailing commas before } or ]
    s = re.sub(r',\s*([}\]])', r'\1', s)

    # Fix missing commas: "value"\n"key" or }\n{ or ]\n[
    s = re.sub(r'(["\d\w}\]])\s*\n\s*(["\[{])', r'\1,\n\2', s)

    # Close unclosed braces/brackets (truncated response)
    opens = 0
    open_sq = 0
    for ch in s:
        if ch == '{':
            opens += 1
        elif ch == '}':
            opens -= 1
        elif ch == '[':
            open_sq += 1
        elif ch == ']':
            open_sq -= 1
    if open_sq > 0:
        s += ']' * open_sq
    if opens > 0:
        s += '}' * opens

    return s


class LLMClient:
    """
    Unified client for multiple LLM providers
    Supports OpenAI and Gemini with automatic failover
    """
    
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.gemini_vision_model = os.getenv("GEMINI_VISION_MODEL", "gemini-2.0-flash")
        self.default_provider = os.getenv("MODEL_PREFERENCE", "auto").lower()
        
        self.max_retries = 3
        self.retry_delay = 2.0
        
        self.stats = {
            'openai_calls': 0,
            'gemini_calls': 0,
            'anthropic_calls': 0,
            'failures': 0,
            'total_tokens': 0
        }
    
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model_preference: Literal["openai", "gemini", "auto"] = "auto",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: str = "json"
    ) -> Dict[str, Any]:
        """
        Generate completion from LLM
        
        Args:
            system_prompt: System/role prompt
            user_prompt: User's prompt
            model_preference: Preferred model ("openai", "gemini", "auto")
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            response_format: "json" or "text"
        
        Returns:
            Dict containing the response
        """
        # Determine which provider to use
        if model_preference == "auto":
            if self.default_provider in ("openai", "gemini"):
                provider = self.default_provider
            else:
                provider = self._select_provider()
        else:
            provider = model_preference
        
        # Try primary provider with retries
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                if provider == "openai":
                    result = await self._call_openai(
                        system_prompt, user_prompt, temperature, max_tokens, response_format
                    )
                elif provider == "gemini":
                    result = await self._call_gemini(
                        system_prompt, user_prompt, temperature, max_tokens, response_format
                    )
                else:
                    raise ValueError(f"Unknown provider: {provider}")

                return result

            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    # Slightly lower temperature on retry to get more stable JSON
                    temperature = max(0.1, temperature - 0.2)
                    print(f"⚠️  {provider} attempt {attempt}/{self.max_retries} failed: {e}  — retrying (temp={temperature:.1f})...")
                    await asyncio.sleep(self.retry_delay * attempt)
                else:
                    print(f"⚠️  {provider} failed after {self.max_retries} attempts: {e}")

        # Try fallback provider (with its own retries)
        if model_preference == "auto":
            fallback = "gemini" if provider == "openai" else "openai"
            for attempt in range(1, self.max_retries + 1):
                try:
                    if attempt == 1:
                        print(f"🔄 Trying fallback: {fallback}")
                    if fallback == "openai":
                        return await self._call_openai(
                            system_prompt, user_prompt, temperature, max_tokens, response_format
                        )
                    else:
                        return await self._call_gemini(
                            system_prompt, user_prompt, temperature, max_tokens, response_format
                        )
                except Exception as fallback_error:
                    last_error = fallback_error
                    if attempt < self.max_retries:
                        await asyncio.sleep(self.retry_delay * attempt)
                    else:
                        print(f"❌ Fallback also failed after {self.max_retries} attempts: {fallback_error}")

        # All failed
        self.stats['failures'] += 1
        raise Exception(f"All LLM providers failed. Last error: {last_error}")

    async def generate_image(
        self,
        prompt: str,
        size: str = "1792x1024",
        quality: str = "standard",
        model_preference: Literal["openai", "gemini", "auto"] = "auto",
    ) -> Dict[str, Any]:
        """
        Generate an image from a text prompt.

        Used for creating reference slide images that are then analyzed for layout.
        Supports DALL-E 3 and Gemini Imagen.

        Returns:
            Dict with either 'image_path' or 'image_data' (base64)
        """
        # Determine provider
        if model_preference == "auto":
            # Prefer OpenAI for image generation (DALL-E 3 is more reliable)
            provider = "openai" if self.openai_key else "gemini"
        else:
            provider = model_preference

        try:
            if provider == "openai":
                return await self._call_dalle(prompt, size, quality)
            elif provider == "gemini":
                return await self._call_imagen(prompt, size)
            else:
                raise ValueError(f"Unknown provider: {provider}")
        except Exception as e:
            # Try fallback
            fallback = "gemini" if provider == "openai" else "openai"
            try:
                print(f"⚠️ {provider} image generation failed, trying {fallback}: {e}")
                if fallback == "openai":
                    return await self._call_dalle(prompt, size, quality)
                else:
                    return await self._call_imagen(prompt, size)
            except Exception as fallback_error:
                self.stats['failures'] += 1
                raise Exception(f"All image generation providers failed. Last error: {fallback_error}")

    async def _call_dalle(
        self,
        prompt: str,
        size: str,
        quality: str,
    ) -> Dict[str, Any]:
        """Generate image using OpenAI DALL-E 3"""
        if not self.openai_key:
            raise ValueError("OpenAI API key not configured")

        # DALL-E 3 supported sizes
        dalle_sizes = {
            "1792x1024": "1792x1024",
            "1024x1792": "1024x1792",
            "1024x1024": "1024x1024",
        }
        dalle_size = dalle_sizes.get(size, "1792x1024")

        payload = {
            "model": "dall-e-3",
            "prompt": prompt,
            "n": 1,
            "size": dalle_size,
            "quality": quality,
            "response_format": "b64_json",
        }

        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/images/generations",
                headers=headers,
                json=payload,
                timeout=120  # Image generation can take time
            ) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    raise Exception(f"DALL-E API error: {resp.status} {text}")
                data = await resp.json()

        image_data = data["data"][0]["b64_json"]
        revised_prompt = data["data"][0].get("revised_prompt", prompt)

        return {
            "image_data": image_data,
            "revised_prompt": revised_prompt,
        }

    async def _call_imagen(
        self,
        prompt: str,
        size: str,
    ) -> Dict[str, Any]:
        """Generate image using Google Imagen (via Gemini)"""
        if not self.gemini_key:
            raise ValueError("Gemini API key not configured")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.gemini_key)

            # Use configured model or default to Imagen
            image_model = os.getenv("GEMINI_IMAGE_MODEL", "imagen-3.0-generate-002")
            model_name = str(image_model or "").lower()

            if "imagen" in model_name:
                response = await asyncio.to_thread(
                    client.models.generate_images,
                    model=image_model,
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        aspect_ratio="16:9",  # Slide format
                        safety_filter_level="BLOCK_ONLY_HIGH",
                    ),
                )

                if response.generated_images:
                    image = response.generated_images[0]
                    image_bytes = image.image.image_bytes
                    import base64
                    image_data = base64.b64encode(image_bytes).decode("utf-8")
                    return {"image_data": image_data}

                raise Exception("No images generated")

            # Gemini image-capable models (e.g., gemini-2.5-flash-image) use generate_content.
            gen_config = types.GenerateContentConfig(response_modalities=["IMAGE"])
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=image_model,
                contents=prompt,
                config=gen_config,
            )
            image_bytes = None
            try:
                parts = response.candidates[0].content.parts or []
            except Exception:
                parts = []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if inline is None:
                    inline = getattr(part, "inlineData", None)
                if inline is None and isinstance(part, dict):
                    inline = part.get("inline_data") or part.get("inlineData")
                if inline:
                    data = getattr(inline, "data", None)
                    if data is None and isinstance(inline, dict):
                        data = inline.get("data")
                    if data:
                        image_bytes = data if isinstance(data, (bytes, bytearray)) else None
                        if image_bytes is None and isinstance(data, str):
                            import base64
                            image_bytes = base64.b64decode(data)
                        break
            if not image_bytes:
                raise Exception("No inline image data returned")

            import base64
            image_data = base64.b64encode(image_bytes).decode("utf-8")
            return {"image_data": image_data}

        except Exception as e:
            raise Exception(f"Imagen API error: {e}")

    async def generate_with_image(
        self,
        system_prompt: str,
        user_prompt: str,
        image_data: str,  # base64 encoded
        mime_type: str = "image/png",
        model_preference: Literal["openai", "gemini", "auto"] = "auto",
        temperature: float = 0.3,
        max_tokens: int = 2000,
        response_format: str = "text"
    ) -> Dict[str, Any]:
        """
        Generate completion with image input (vision).

        Used for layout analysis of reference images.
        Supports GPT-4 Vision and Gemini Pro Vision.
        """
        # Determine provider
        if model_preference == "auto":
            provider = self._select_provider()
        else:
            provider = model_preference

        try:
            if provider == "openai":
                return await self._call_openai_vision(
                    system_prompt, user_prompt, image_data, mime_type,
                    temperature, max_tokens, response_format
                )
            elif provider == "gemini":
                return await self._call_gemini_vision(
                    system_prompt, user_prompt, image_data, mime_type,
                    temperature, max_tokens, response_format
                )
            else:
                raise ValueError(f"Unknown provider: {provider}")
        except Exception as e:
            # Try fallback
            fallback = "gemini" if provider == "openai" else "openai"
            try:
                print(f"⚠️ {provider} vision failed, trying {fallback}: {e}")
                if fallback == "openai":
                    return await self._call_openai_vision(
                        system_prompt, user_prompt, image_data, mime_type,
                        temperature, max_tokens, response_format
                    )
                else:
                    return await self._call_gemini_vision(
                        system_prompt, user_prompt, image_data, mime_type,
                        temperature, max_tokens, response_format
                    )
            except Exception as fallback_error:
                self.stats['failures'] += 1
                raise Exception(f"All vision providers failed. Last error: {fallback_error}")

    async def _call_openai_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        image_data: str,
        mime_type: str,
        temperature: float,
        max_tokens: int,
        response_format: str
    ) -> Dict[str, Any]:
        """Call OpenAI Vision API (GPT-4V)"""
        if not self.openai_key:
            raise ValueError("OpenAI API key not configured")

        # Use gpt-4o or gpt-4-vision-preview for vision
        vision_model = "gpt-4o" if "gpt-4o" in self.openai_model else "gpt-4o"

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ]

        payload = {
            "model": vision_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=90  # Longer timeout for vision
            ) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    raise Exception(f"OpenAI Vision API error: {resp.status} {text}")
                data = await resp.json()

        content = data["choices"][0]["message"]["content"]
        self.stats['openai_calls'] += 1

        return {"response": content}

    async def _call_gemini_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        image_data: str,
        mime_type: str,
        temperature: float,
        max_tokens: int,
        response_format: str
    ) -> Dict[str, Any]:
        """Call Gemini Vision API"""
        if not self.gemini_key:
            raise ValueError("Gemini API key not configured")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.gemini_key)

            # Decode base64 image
            import base64
            image_bytes = base64.b64decode(image_data)

            # Create image part
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

            # Combine prompts
            full_prompt = f"{system_prompt}\n\n{user_prompt}"

            gen_config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )

            # Use configured Gemini vision model
            vision_model = self.gemini_vision_model or "gemini-2.0-flash"

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=vision_model,
                contents=[full_prompt, image_part],
                config=gen_config,
            )

            content = getattr(response, "text", "")
            if not content:
                try:
                    candidates = getattr(response, "candidates", None) or []
                    if candidates:
                        parts = candidates[0].content.parts or []
                        content = "\n".join(
                            getattr(p, "text", "") for p in parts if getattr(p, "text", None)
                        )
                except Exception:
                    content = ""

            self.stats['gemini_calls'] += 1
            return {"response": content}

        except Exception as e:
            raise Exception(f"Gemini Vision API error: {e}")

    async def _call_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        response_format: str
    ) -> Dict[str, Any]:
        """Call OpenAI API"""
        if not self.openai_key:
            raise ValueError("OpenAI API key not configured")
        
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            payload = {
                "model": self.openai_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            if response_format == "json":
                payload["response_format"] = {"type": "json_object"}

            headers = {
                "Authorization": f"Bearer {self.openai_key}",
                "Content-Type": "application/json"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60
                ) as resp:
                    if resp.status >= 400:
                        text = await resp.text()
                        raise Exception(f"OpenAI API error: {resp.status} {text}")
                    data = await resp.json()

            content = data["choices"][0]["message"]["content"]

            self.stats['openai_calls'] += 1
            self.stats['total_tokens'] += data.get("usage", {}).get("total_tokens", 0)

            if response_format == "json":
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        return json.loads(_repair_json(content))

            return {"response": content}

        except Exception as e:
            raise Exception(f"OpenAI API error: {e}")
    
    async def _call_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        response_format: str
    ) -> Dict[str, Any]:
        """Call Gemini API"""
        if not self.gemini_key:
            raise ValueError("Gemini API key not configured")
        
        try:
            from google import genai
            client = genai.Client(api_key=self.gemini_key)

            # Combine system and user prompts
            full_prompt = f"{system_prompt}\n\n{user_prompt}"

            if response_format == "json":
                full_prompt += "\n\nRespond with valid JSON only. No markdown formatting."

            gen_config = genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.gemini_model,
                contents=full_prompt,
                config=gen_config,
            )

            content = getattr(response, "text", None)
            if not content:
                content = ""
                try:
                    candidates = getattr(response, "candidates", None) or []
                    if candidates:
                        parts = candidates[0].content.parts or []
                        content = "\n".join(
                            getattr(p, "text", "") for p in parts if getattr(p, "text", None)
                        )
                except Exception:
                    content = ""
            
            self.stats['gemini_calls'] += 1
            
            # Parse JSON if needed
            if response_format == "json":
                # Clean markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()

                # Attempt 1: direct parse
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    pass

                # Attempt 2: repair common LLM JSON errors
                try:
                    return json.loads(_repair_json(content))
                except json.JSONDecodeError:
                    pass

                # Attempt 3: extract outermost JSON object with regex
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except json.JSONDecodeError:
                        # Attempt 4: repair the extracted JSON
                        return json.loads(_repair_json(json_match.group()))

                raise json.JSONDecodeError("No valid JSON found in response", content, 0)
            
            return {"response": content}
            
        except Exception as e:
            raise Exception(f"Gemini API error: {e}")
    
    def _select_provider(self) -> str:
        """Select best available provider"""
        # Check which keys are available
        providers = []
        
        if self.openai_key:
            providers.append("openai")
        
        if self.gemini_key:
            providers.append("gemini")
        
        if not providers:
            raise ValueError("No LLM API keys configured")
        
        # Simple load balancing: alternate between providers
        total_calls = self.stats['openai_calls'] + self.stats['gemini_calls']
        
        if "openai" in providers and "gemini" in providers:
            # Alternate
            return "openai" if total_calls % 2 == 0 else "gemini"
        
        # Return the only available provider
        return providers[0]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        return {
            **self.stats,
            'timestamp': datetime.now().isoformat()
        }
    
    def reset_stats(self):
        """Reset statistics"""
        self.stats = {
            'openai_calls': 0,
            'gemini_calls': 0,
            'anthropic_calls': 0,
            'failures': 0,
            'total_tokens': 0
        }


# Simple mock for testing without API keys
class MockLLMClient:
    """Mock LLM client for testing"""
    
    def __init__(self):
        self.stats = {'mock_calls': 0}
    
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Return mock response"""
        await asyncio.sleep(0.5)  # Simulate API delay
        
        self.stats['mock_calls'] += 1
        
        # Return simple mock based on prompt content
        if "plan" in user_prompt.lower():
            return {
                "slides": [
                    {
                        "slide_number": 1,
                        "title": "Introduction",
                        "content_type": "title",
                        "key_points": ["Overview"],
                        "design_notes": "Bold title"
                    }
                ]
            }
        elif "research" in user_prompt.lower():
            return {
                "facts": ["Important fact", "Another fact"],
                "statistics": {"key_metric": "100"},
                "examples": ["Example case"]
            }
        elif "write" in user_prompt.lower() or "content" in user_prompt.lower():
            return {
                "title": "Slide Title",
                "content": ["Point 1", "Point 2", "Point 3"],
                "speaker_notes": "Discuss these points"
            }
        elif "chart" in user_prompt.lower():
            return {
                "chart_type": "bar",
                "data": [100, 150, 200, 250],
                "labels": ["A", "B", "C", "D"]
            }
        elif "design" in user_prompt.lower():
            return {
                "colors": {"primary": "#1E2761"},
                "fonts": {"title": "Calibri"}
            }
        elif "review" in user_prompt.lower():
            return {
                "overall_score": 8.5,
                "strengths": ["Good content"],
                "improvements": []
            }
        
        return {"response": "Mock response"}
    
    def get_stats(self):
        return self.stats
