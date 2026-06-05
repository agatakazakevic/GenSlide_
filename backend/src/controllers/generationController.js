// backend/src/controllers/generationController.js
import { editChartData, generateOutline, generateChartCandidates } from '../services/geminiService.js';
import { getDiverseChunks, buildContextWindow } from '../services/ragService.js';

const normalizeDocumentIds = (documentIds, documentId) => {
  if (Array.isArray(documentIds) && documentIds.length > 0) return documentIds;
  if (documentId) return [documentId];
  return [];
};

export const createOutline = async (req, res) => {
  try {
    const { documentIds, documentId, userPrompt, deckType, slideCount } = req.body;
    const ids = normalizeDocumentIds(documentIds, documentId);
    if (ids.length === 0) {
      const outline = await generateOutline([], userPrompt, deckType, slideCount);
      return res.json({
        success: true,
        outline,
        chunksAnalyzed: 0,
      });
    }

    const allChunks = [];
    for (const docId of ids) {
      const result = await getDiverseChunks(docId, 'priority');
      allChunks.push(...result.chunks);
    }

    const outline = await generateOutline(allChunks, userPrompt, deckType, slideCount);
    return res.json({
      success: true,
      outline,
      chunksAnalyzed: allChunks.length,
    });
  } catch (error) {
    console.error('Outline generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate outline',
      message: error.message,
    });
  }
};

export const editChart = async (req, res) => {
  try {
    const { chartData, prompt, context } = req.body || {};
    if (!chartData) {
      return res.status(400).json({ error: 'chartData is required' });
    }
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const updated = await editChartData(chartData, prompt, context);
    return res.json({ success: true, chartData: updated });
  } catch (error) {
    console.error('Chart edit error:', error);
    return res.status(500).json({
      error: 'Failed to edit chart',
      message: error.message,
    });
  }
};

export const autoGenerateCharts = async (req, res) => {
  try {
    const { documentIds, documentId, slide, chartTypes } = req.body || {};
    const ids = normalizeDocumentIds(documentIds, documentId);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Document IDs required' });
    }
    if (!slide) {
      return res.status(400).json({ error: 'Slide payload required' });
    }

    const query = `Extract numeric data for charts relevant to: ${slide.title || 'current slide'}.`;
    const contextResult = await buildContextWindow(query, ids, 3500);
    const result = await generateChartCandidates(contextResult.chunks, slide, chartTypes);

    return res.json({
      success: true,
      candidates: result.candidates || [],
      missing: result.missing || [],
      chunksAnalyzed: contextResult.chunks.length,
    });
  } catch (error) {
    console.error('Auto chart generation error:', error);
    return res.status(500).json({
      error: 'Failed to auto-generate charts',
      message: error.message,
    });
  }
};

export default {
  createOutline,
  editChart,
  autoGenerateCharts,
};
