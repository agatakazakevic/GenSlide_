const IMAGE_MODEL_NAME = (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image').replace(
  /^models\//,
  ''
);
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const getApiKey = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not set');
  }
  return apiKey;
};

/**
 * Generate image using Gemini Imagen (when available)
 * For now, this uses a placeholder approach
 */
export const generateImage = async (prompt) => {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${API_BASE}/models/${IMAGE_MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Image generation failed: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);

    if (!imagePart) {
      throw new Error('No image data returned from Gemini');
    }

    const inlineData = imagePart.inlineData || imagePart.inline_data;
    const base64 = inlineData.data;
    const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      success: true,
      prompt,
      mimeType,
      dataUrl,
    };
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
};

/**
 * Batch generate images for all slides
 */
export const batchGenerateImages = async (imagePrompts) => {
  console.log(`Generating ${imagePrompts.length} images...`);
  const results = [];

  for (const prompt of imagePrompts) {
    try {
      const result = await generateImage(prompt.prompt);
      results.push({
        ...prompt,
        success: true,
        dataUrl: result.dataUrl,
        mimeType: result.mimeType,
      });
    } catch (error) {
      results.push({
        ...prompt,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
};

export default {
  generateImage,
  batchGenerateImages
};
