"""
Image/Illustration Agent
Uses LLM to suggest icons and generate illustration prompts/images.
"""

from __future__ import annotations

import asyncio
import base64
import os
import tempfile
import uuid
from typing import Dict, Any, List

import aiohttp


class ImageAgent:
    def __init__(self, llm_client):
        self.llm_client = llm_client
        self.gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.gemini_image_model = os.getenv("GEMINI_IMAGE_MODEL", "nano-banana-pro-preview")
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.openai_image_model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
        self.enable_images = os.getenv("ENABLE_IMAGE_GENERATION", "1").lower() in {"1", "true", "yes"}
        print(
            "🧪 ImageAgent keys:",
            "gemini=on" if self.gemini_key else "gemini=off",
            "| openai=on" if self.openai_key else "| openai=off",
        )

    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Return icon suggestions for a list of steps/items.
        """
        title = payload.get("title", "Slide")
        items = payload.get("items", [])[:5]
        count = len(items) or 3

        prompt = f"""You are designing a business slide.
Suggest simple, professional emoji icons for each step label.
Return JSON with an array called "icons" of length {count}.

TITLE: {title}
STEPS:
{chr(10).join(f"- {item}" for item in items)}

Rules:
- Use minimal emoji (single character) per item
- Keep icons business/tech appropriate
- If unsure, use: 📌, 🔁, ✅, 📈, ⚙️
"""

        try:
            response = await self.llm_client.generate(
                system_prompt="Return only valid JSON.",
                user_prompt=prompt,
                temperature=0.4,
                response_format="json",
            )
        except Exception:
            response = {"icons": []}

        icons = response.get("icons", []) if isinstance(response, dict) else []
        if not isinstance(icons, list):
            icons = []
        if len(icons) < count:
            fallback = ["🔁", "⚙️", "✅", "📈", "📌"]
            icons = (icons + fallback)[:count]

        return {"icons": icons}

    async def generate_illustration(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate an illustration prompt and (optionally) an image.
        Returns: {prompt, path}
        """
        title = payload.get("title", "Slide")
        items = payload.get("items", [])[:5]
        layout = payload.get("layout_type", "slide")
        style_hint = payload.get("style_hint", "headline illustration")
        aspect_hint = payload.get("aspect_hint", "square")

        prompt = f"""Create a clean, minimal, professional business illustration for a presentation slide.
Slide title: {title}
Key items: {", ".join(str(i) for i in items)}
Style: flat vector, {style_hint}, modern, light background, navy/blue accent tones.
Composition: {aspect_hint} format.

MUST:
- Professional, corporate-appropriate imagery
- Clean lines, minimal detail, modern flat design
- Relevant to the slide topic (not generic clip art)

MUST NOT:
- No text, labels, watermarks, or words in the image
- No photorealistic style
- No cluttered or busy compositions
- No cartoonish or childish style
"""

        # Choose image size based on aspect hint
        if "landscape" in aspect_hint:
            openai_size = "1536x1024"
        elif "portrait" in aspect_hint:
            openai_size = "1024x1536"
        else:
            openai_size = "1024x1024"

        image_path = None
        if self.enable_images:
            image_path = await self._generate_image(prompt, openai_size=openai_size)
        else:
            print("🖼️  Image generation disabled (ENABLE_IMAGE_GENERATION=0)")

        if image_path:
            print(f"🖼️  Image generated: {image_path}")
        else:
            print("🖼️  No image generated; using placeholder")

        return {"prompt": prompt, "path": image_path}

    async def generate_from_prompt(
        self,
        prompt: str,
        aspect_hint: str = "landscape",
    ) -> Dict[str, Any]:
        """Generate an image directly from a supplied prompt."""
        if not prompt:
            return {"prompt": prompt, "path": None}

        if "landscape" in aspect_hint:
            openai_size = "1536x1024"
        elif "portrait" in aspect_hint:
            openai_size = "1024x1536"
        else:
            openai_size = "1024x1024"

        image_path = None
        if self.enable_images:
            image_path = await self._generate_image(prompt, openai_size=openai_size)
        else:
            print("🖼️  Image generation disabled (ENABLE_IMAGE_GENERATION=0)")

        if image_path:
            print(f"🖼️  Image generated: {image_path}")
        else:
            print("🖼️  No image generated; using placeholder")

        return {"prompt": prompt, "path": image_path}

    async def choose_placement(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Choose the best illustration slot among candidates.
        Returns: {slot_id}
        """
        title = payload.get("title", "Slide")
        layout_type = payload.get("layout_type", "slide")
        candidates = payload.get("candidates", [])
        if not candidates:
            return {"slot_id": None}

        prompt = f"""Select the best illustration placement slot for the slide.
Return JSON: {{"slot_id":"<id>"}} using one of the provided slot ids.

TITLE: {title}
LAYOUT: {layout_type}
SLOTS:
{chr(10).join(f"- {c['id']}: {c['desc']}" for c in candidates)}

Rules:
- Avoid covering charts or dense text
- Prefer corners or side gutters
- Keep visual balance
"""
        try:
            response = await self.llm_client.generate(
                system_prompt="Return only valid JSON.",
                user_prompt=prompt,
                temperature=0.2,
                response_format="json",
            )
        except Exception:
            response = {"slot_id": None}

        slot_id = response.get("slot_id") if isinstance(response, dict) else None
        return {"slot_id": slot_id}

    async def _generate_image(
        self, prompt: str, openai_size: str = "1024x1024"
    ) -> str | None:
        # Try Gemini image model first (Gemini does not support size hints)
        if self.gemini_key:
            try:
                from google import genai

                client = genai.Client(api_key=self.gemini_key)
                response = await self._run_gemini_image(client, prompt)
                if response:
                    return response
            except Exception as exc:
                print(f"🖼️  Gemini image generation failed: {exc}")
        else:
            print("🖼️  Gemini key not set; skipping Gemini image generation")

        # Fallback to OpenAI image API
        if self.openai_key:
            try:
                return await self._run_openai_image(prompt, size=openai_size)
            except Exception as exc:
                print(f"🖼️  OpenAI image generation failed: {exc}")
        else:
            print("🖼️  OpenAI key not set; skipping OpenAI image generation")

        return None

    async def _run_gemini_image(self, client, prompt: str) -> str | None:
        debug_summary = {"env_model": self.gemini_image_model}
        model_name = str(self.gemini_image_model or "").lower()

        # Imagen models use generate_images; Gemini image models use generate_content.
        if "imagen" in model_name:
            try:
                response = await asyncio.to_thread(
                    client.models.generate_images,
                    model=self.gemini_image_model,
                    prompt=prompt,
                )
                images = getattr(response, "images", None) or []
                if images:
                    image = images[0]
                    image_bytes = getattr(image, "image_bytes", None)
                    if image_bytes:
                        return self._write_image_bytes(image_bytes, ext="png")
                    gcs_uri = getattr(image, "gcs_uri", None)
                    if gcs_uri:
                        print(f"🖼️  Gemini returned GCS URI (not downloaded): {gcs_uri}")
                debug_summary.update({"images": len(images)})
            except Exception as exc:
                debug_summary.update({"generate_images_error": str(exc)})

        # Gemini image-capable models return inline image data via generate_content.
        try:
            from google.genai import types
            gen_config = types.GenerateContentConfig(response_modalities=["IMAGE"])
        except Exception:
            gen_config = None

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=self.gemini_image_model,
            contents=prompt,
            config=gen_config,
        )
        # Attempt to find inline image data
        parts = []
        try:
            parts = response.candidates[0].content.parts
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
                    if isinstance(data, str):
                        image_bytes = base64.b64decode(data)
                    else:
                        image_bytes = data
                    return self._write_image_bytes(image_bytes, ext="png")

        # If we got here, Gemini didn't return inline image data
        try:
            part_types = [
                getattr(p, "mime_type", None)
                or getattr(getattr(p, "inline_data", None), "mime_type", None)
                or getattr(getattr(p, "inlineData", None), "mime_type", None)
                for p in parts
            ]
        except Exception:
            part_types = []
        debug_summary.update({"parts": len(parts), "types": part_types})
        try:
            raw = response.to_dict()
            candidates = raw.get("candidates", [])
            part_keys = []
            for candidate in candidates:
                for part in candidate.get("content", {}).get("parts", []) or []:
                    part_keys.append(sorted(part.keys()))
            debug_summary["candidates"] = len(candidates)
            debug_summary["part_keys"] = part_keys[:5]
        except Exception:
            pass
        print(f"🖼️  Gemini returned no inline image data: {debug_summary}")
        return None

    async def _run_openai_image(self, prompt: str, size: str = "1024x1024") -> str | None:
        url = "https://api.openai.com/v1/images/generations"
        headers = {"Authorization": f"Bearer {self.openai_key}"}
        payload = {"model": self.openai_image_model, "prompt": prompt, "size": size}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload, timeout=60) as resp:
                if resp.status >= 400:
                    body = await resp.text()
                    print(f"🖼️  OpenAI image HTTP {resp.status}: {body}")
                    return None
                data = await resp.json()
        b64 = data.get("data", [{}])[0].get("b64_json")
        if not b64:
            return None
        return self._write_image_bytes(base64.b64decode(b64), ext="png")

    def _write_image_bytes(self, image_bytes: bytes, ext: str = "png") -> str:
        out_dir = os.getenv("IMAGE_OUTPUT_DIR") or os.path.join(tempfile.gettempdir(), "slide_images")
        os.makedirs(out_dir, exist_ok=True)
        filename = f"img_{uuid.uuid4().hex}.{ext}"
        path = os.path.join(out_dir, filename)
        with open(path, "wb") as f:
            f.write(image_bytes)
        return path
