import json
import os
from typing import List, Dict, Any
from google.generativeai import GenerativeModel, configure


def _normalize(name: str) -> str:
    return name.replace('models/', '')


TEXT_MODEL_NAME = _normalize(os.getenv('GEMINI_TEXT_MODEL', 'gemini-flash-latest'))
EMBEDDING_MODEL_NAME = _normalize(os.getenv('GEMINI_EMBEDDING_MODEL', 'text-embedding-004'))


configure(api_key=os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY'))
text_model = GenerativeModel(TEXT_MODEL_NAME)
embedding_model = GenerativeModel(EMBEDDING_MODEL_NAME)


def generate_outline(document_chunks: List[Dict[str, Any]], user_prompt: str = '') -> str:
    context = "\n".join([f"[Chunk {idx + 1}]:\n{chunk['text']}\n" for idx, chunk in enumerate(document_chunks)])
    user_block = f"User Request: {user_prompt}\n\n" if user_prompt else ""
    prompt = (
        "Create a structured presentation outline based on the document content. "
        "Return a concise, ordered outline with section titles and short bullet points.\n\n"
        f"{user_block}"
        f"Document Content:\n{context}"
    )
    result = text_model.generate_content(prompt)
    return result.text.strip()


def generate_embedding(text: str) -> List[float]:
    result = embedding_model.embed_content(text)
    return result['embedding']


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    return [generate_embedding(text) for text in texts]


def generate_editable_presentation_json(document_chunks: List[Dict[str, Any]], user_prompt: str = '') -> Dict[str, Any]:
    context = "\n".join(
        [f"[Chunk {idx + 1}]:\n{chunk['text']}\nPage: {chunk['metadata'].get('page', idx)}\n" for idx, chunk in enumerate(document_chunks)]
    )
    user_block = f"User Request: {user_prompt}\n\n" if user_prompt else ""

    prompt = f"""You are an expert presentation designer. Create a professional presentation JSON for PowerPoint.

IMPORTANT: Return ONLY valid JSON with this structure:
{{
  "metadata": {{"title": "Title", "subtitle": "Subtitle", "author": "Presentation Studio", "theme": "professional"}},
  "slides": [
    {{
      "slideId": "slide_001",
      "type": "title",
      "title": "Main Title",
      "subtitle": "Subtitle text",
      "backgroundColor": "#1e40af",
      "textColor": "#ffffff",
      "image": {{
        "placeholderId": "img_title",
        "prompt": "Detailed image prompt",
        "position": "center"
      }}
    }}
  ]
}}

Guidelines:
- Text should be editable bullet points.
- Charts must include chartData with labels/datasets.
- Tables must include headers/rows.
- Images must be prompts with placeholderId.

{user_block}
Document Content:
{context}
"""

    result = text_model.generate_content(prompt)
    raw_text = result.text.strip()
    if raw_text.startswith('```'):
        raw_text = raw_text.replace('```json', '').replace('```', '').strip()
    parsed = json.loads(raw_text)
    if 'metadata' not in parsed or 'slides' not in parsed:
        raise ValueError('Invalid JSON structure')
    return parsed


def extract_image_prompts(presentation_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    image_prompts = []
    max_prompts = int(os.getenv('MAX_IMAGE_PROMPTS', '2'))

    for slide in presentation_json.get('slides', []):
        if slide.get('image') and slide['image'].get('prompt'):
            image_prompts.append({
                "slideId": slide.get('slideId'),
                "placeholderId": slide['image'].get('placeholderId'),
                "prompt": slide['image'].get('prompt'),
                "position": slide['image'].get('position', 'center'),
            })
            if len(image_prompts) >= max_prompts:
                return image_prompts

    return image_prompts
