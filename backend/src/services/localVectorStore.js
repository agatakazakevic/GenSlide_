// backend/src/services/localVectorStore.js
import { randomUUID } from 'crypto';

const collections = new Map();

const ensureCollection = (collectionName, vectorSize = 768) => {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, { vectorSize, points: [] });
  }
  return collections.get(collectionName);
};

const toFloatArray = (vector = []) => vector.map((v) => Number(v) || 0);

const vecNorm = (vector = []) => {
  let sum = 0;
  for (const value of vector) sum += value * value;
  return Math.sqrt(sum);
};

const dot = (a = [], b = []) => {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
};

const cosineSimilarity = (a = [], b = [], bNorm = null) => {
  const normA = vecNorm(a);
  const normB = bNorm ?? vecNorm(b);
  if (!normA || !normB) return 0;
  return dot(a, b) / (normA * normB);
};

const applyFilter = (points, filter) => {
  if (!filter || !Array.isArray(filter.must) || !filter.must.length) return points;
  return points.filter((point) => {
    return filter.must.every((condition) => {
      const key = condition?.key;
      const value = condition?.match?.value;
      if (!key) return true;
      return point.payload?.[key] === value;
    });
  });
};

export const createCollection = async (collectionName, vectorSize = 768) => {
  const exists = collections.has(collectionName);
  if (!exists) {
    collections.set(collectionName, { vectorSize, points: [] });
  }
  return { success: true, exists };
};

export const deleteCollection = async (collectionName) => {
  collections.delete(collectionName);
  return { success: true };
};

export const storeDocumentChunks = async (collectionName, chunks, embeddings, metadata = {}) => {
  const collection = ensureCollection(collectionName, embeddings?.[0]?.length || 768);
  const documentId = metadata?.documentId;

  if (documentId) {
    collection.points = collection.points.filter((point) => point.payload?.documentId !== documentId);
  }

  const points = chunks.map((chunk, idx) => {
    const vector = toFloatArray(embeddings[idx] || []);
    return {
      id: randomUUID(),
      vector,
      norm: vecNorm(vector),
      payload: {
        text: chunk.text,
        documentId: metadata.documentId,
        documentName: metadata.documentName,
        chunkIndex: idx,
        page: chunk.page || 0,
        totalChunks: chunks.length,
        createdAt: new Date().toISOString(),
        ...chunk.metadata,
      },
    };
  });

  collection.points.push(...points);

  return {
    success: true,
    chunksStored: points.length,
    collectionName,
  };
};

export const searchSimilarChunks = async (collectionName, queryEmbedding, topK = 10, filter = null) => {
  const collection = collections.get(collectionName);
  if (!collection) return [];
  const queryVector = toFloatArray(queryEmbedding || []);
  const filtered = applyFilter(collection.points, filter);
  const scored = filtered.map((point) => ({
    point,
    score: cosineSimilarity(queryVector, point.vector, point.norm),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ point, score }) => ({
    id: point.id,
    score,
    text: point.payload.text,
    metadata: {
      documentId: point.payload.documentId,
      documentName: point.payload.documentName,
      page: point.payload.page,
      chunkIndex: point.payload.chunkIndex,
    },
  }));
};

export const searchMultipleQueries = async (collectionName, queryEmbeddings, topK = 5) => {
  const allResults = [];
  for (const embedding of queryEmbeddings) {
    const results = await searchSimilarChunks(collectionName, embedding, topK);
    allResults.push(...results);
  }

  const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values());
  uniqueResults.sort((a, b) => b.score - a.score);
  return uniqueResults.slice(0, topK * 2);
};

export const getDocumentChunks = async (collectionName, documentId) => {
  const collection = collections.get(collectionName);
  if (!collection) return [];
  return collection.points
    .filter((point) => point.payload?.documentId === documentId)
    .map((point) => ({
      id: point.id,
      text: point.payload.text,
      metadata: {
        page: point.payload.page,
        chunkIndex: point.payload.chunkIndex,
        documentName: point.payload.documentName,
      },
    }));
};

export const deleteDocumentChunks = async (collectionName, documentId) => {
  const collection = collections.get(collectionName);
  if (!collection) return { success: true };
  collection.points = collection.points.filter((point) => point.payload?.documentId !== documentId);
  return { success: true };
};

export const getCollectionInfo = async (collectionName) => {
  const collection = collections.get(collectionName);
  if (!collection) {
    return { name: collectionName, vectorsCount: 0, pointsCount: 0, status: 'missing' };
  }
  return {
    name: collectionName,
    vectorsCount: collection.vectorSize,
    pointsCount: collection.points.length,
    status: 'ok',
    config: { vectorSize: collection.vectorSize },
  };
};

export const listCollections = async () => {
  return Array.from(collections.keys()).map((name) => ({ name }));
};

export const healthCheck = async () => ({ status: 'healthy', message: 'Local vector store ready' });

export default {
  createCollection,
  deleteCollection,
  storeDocumentChunks,
  searchSimilarChunks,
  searchMultipleQueries,
  getDocumentChunks,
  deleteDocumentChunks,
  getCollectionInfo,
  listCollections,
  healthCheck,
};
