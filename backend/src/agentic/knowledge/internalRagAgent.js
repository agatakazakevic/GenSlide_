import { retrieveAndRerank } from '../../services/ragService.js';

const extractNumbers = (text = '') => {
  const matches = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/g);
  if (!matches) return [];
  return matches.map((value) => value.replace(/,/g, ''));
};

const buildDatasetsFromChunks = (chunks = []) => {
  const datasets = [];
  chunks.forEach((chunk) => {
    const numbers = extractNumbers(chunk.text || '');
    if (numbers.length >= 2) {
      datasets.push({
        id: `ds_${chunk.id || Math.random().toString(36).slice(2, 8)}`,
        label: chunk.metadata?.sectionTitle || 'Dataset',
        values: numbers.slice(0, 6).map((value) => Number(value.replace('%', ''))),
        units: numbers.some((n) => n.includes('%')) ? '%' : '',
        source: {
          documentId: chunk.metadata?.documentId,
          chunkId: chunk.id,
          page: chunk.metadata?.page,
        },
      });
    }
  });
  return datasets;
};

export const internalRagAgent = async ({ query, documentIds = [], topK = 10 }) => {
  if (!documentIds.length) {
    return { evidence: [], datasets: [], coverage: 0 };
  }

  const result = await retrieveAndRerank(query, documentIds, topK, Math.max(12, topK * 2));
  const evidence = (result.chunks || []).map((chunk, idx) => ({
    id: `int_${idx + 1}`,
    text: String(chunk.text || '').trim(),
    source: {
      type: 'internal',
      documentId: chunk.metadata?.documentId,
      chunkId: chunk.id,
      page: chunk.metadata?.page,
      section: chunk.metadata?.sectionTitle,
    },
    confidence: Number(chunk.rerankScore || chunk.score || 0.5),
  }));

  const datasets = buildDatasetsFromChunks(result.chunks || []);
  const coverage = evidence.length ? Math.min(1, evidence.length / topK) : 0;

  return { evidence, datasets, coverage };
};
