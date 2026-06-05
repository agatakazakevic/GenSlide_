import os
import requests

API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
IMAGE_MODEL = os.getenv('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image').replace('models/', '')
API_KEY = os.getenv('GOOGLE_API_KEY')


def generate_image(prompt: str) -> dict:
    if not API_KEY:
        raise ValueError('GOOGLE_API_KEY is not set')

    response = requests.post(
        f"{API_BASE}/models/{IMAGE_MODEL}:generateContent",
        params={"key": API_KEY},
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        },
        timeout=120,
    )

    if response.status_code != 200:
        raise ValueError(f"Image generation failed: {response.status_code} {response.text}")

    data = response.json()
    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    image_part = next((part for part in parts if part.get('inlineData') or part.get('inline_data')), None)
    if not image_part:
        raise ValueError('No image data returned')

    inline = image_part.get('inlineData') or image_part.get('inline_data')
    base64_data = inline.get('data')
    mime_type = inline.get('mimeType') or inline.get('mime_type') or 'image/png'

    return {
        "dataUrl": f"data:{mime_type};base64,{base64_data}",
        "mimeType": mime_type,
    }


def batch_generate_images(image_prompts: list) -> list:
    results = []
    for prompt in image_prompts:
        try:
            image = generate_image(prompt['prompt'])
            results.append({
                **prompt,
                "success": True,
                "dataUrl": image["dataUrl"],
                "mimeType": image["mimeType"],
            })
        except Exception as exc:  # noqa: BLE001
            results.append({
                **prompt,
                "success": False,
                "error": str(exc),
            })
    return results
