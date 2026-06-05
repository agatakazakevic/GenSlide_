// backend/src/services/ragService.js
import { processPDFToChunks } from './pdfService.js';
import { processTabularToChunks } from './tabularService.js';
import { generateEmbedding, generateEmbeddingsBatch } from './geminiService.js';
import {
  createCollection,
  storeDocumentChunks,
  searchSimilarChunks,
  getDocumentChunks,
} from './localVectorStore.js';

const toCollectionName = (documentId) => `doc_${documentId.replace(/^doc_/, '')}`;

/**
 * Process and index a PDF document
 */
export const indexDocument = async (filePath, documentId, documentName) => {
  try {
    console.log(`Starting document indexing for: ${documentName}`);

    // Step 1: Process PDF into chunks
    const pdfData = await processPDFToChunks(filePath, {
      chunkSize: 800,      // Optimal size for semantic search
      overlap: 100,        // Maintain context between chunks
      extractSectionsFlag: true,
    });

    console.log(`Extracted ${pdfData.totalChunks} chunks from ${pdfData.numPages} pages`);

    // Step 2: Create local collection (if not exists)
    const collectionName = toCollectionName(documentId);
    await createCollection(collectionName, 768); // Gemini embedding size

    // Step 3: Generate embeddings for all chunks
    console.log('Generating embeddings...');
    const texts = pdfData.chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddingsBatch(texts);

    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 4: Store chunks with embeddings in local vector store
    await storeDocumentChunks(
      collectionName,
      pdfData.chunks,
      embeddings,
      {
        documentId,
        documentName,
      }
    );

    return {
      success: true,
      documentId,
      collectionName,
      chunksIndexed: pdfData.totalChunks,
      numPages: pdfData.numPages,
      sections: pdfData.sections,
      metadata: pdfData.metadata,
    };
  } catch (error) {
    console.error('Document indexing error:', error);
    throw new Error(`Failed to index document: ${error.message}`);
  }
};

/**
 * Process and index CSV/XLSX tabular document
 */
export const indexTabularDocument = async (filePath, documentId, documentName) => {
  try {
    console.log(`Starting tabular indexing for: ${documentName}`);

    const tableData = await processTabularToChunks(filePath, {
      chunkSize: 20,
    });

    console.log(`Extracted ${tableData.totalChunks} chunks from ${tableData.totalRows} rows`);

    const collectionName = toCollectionName(documentId);
    await createCollection(collectionName, 768);

    const texts = tableData.chunks.map((chunk) => chunk.text);
    const embeddings = await generateEmbeddingsBatch(texts);

    await storeDocumentChunks(
      collectionName,
      tableData.chunks,
      embeddings,
      {
        documentId,
        documentName,
      }
    );

    return {
      success: true,
      documentId,
      collectionName,
      chunksIndexed: tableData.totalChunks,
      numPages: 0,
      sections: tableData.sheets.map((sheet) => ({
        title: sheet.name,
        rows: sheet.rows,
      })),
      metadata: {
        totalRows: tableData.totalRows,
        sheets: tableData.sheets,
      },
    };
  } catch (error) {
    console.error('Tabular indexing error:', error);
    throw new Error(`Failed to index tabular document: ${error.message}`);
  }
};

/**
 * Retrieve relevant chunks for a query
 */
export const retrieveRelevantChunks = async (query, documentIds, topK = 10) => {
  try {
    console.log(`Retrieving chunks for query: "${query}"`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Search across all specified document collections
    const allResults = [];
    
    for (const docId of documentIds) {
      const collectionName = toCollectionName(docId);
      
      try {
        const results = await searchSimilarChunks(
          collectionName,
          queryEmbedding,
          topK
        );
        allResults.push(...results);
      } catch (error) {
        console.error(`Error searching collection ${collectionName}:`, error);
        // Continue with other collections
      }
    }

    // Sort by relevance score and take top K
    const sortedResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`Retrieved ${sortedResults.length} relevant chunks`);

    return {
      query,
      chunks: sortedResults,
      totalResults: allResults.length,
    };
  } catch (error) {
    console.error('Chunk retrieval error:', error);
    throw new Error(`Failed to retrieve chunks: ${error.message}`);
  }
};

/**
 * Retrieve chunks with re-ranking for better relevance
 */
export const retrieveAndRerank = async (query, documentIds, topK = 10, rerankTop = 20) => {
  try {
    // First pass: Get more chunks than needed
    const initialResults = await retrieveRelevantChunks(query, documentIds, rerankTop);

    // Re-rank by combining similarity score with metadata relevance
    const reranked = initialResults.chunks.map(chunk => {
      let bonusScore = 0;

      // Boost chunks from introduction/summary sections
      if (chunk.metadata.sectionTitle?.toLowerCase().includes('introduction') ||
          chunk.metadata.sectionTitle?.toLowerCase().includes('summary') ||
          chunk.metadata.sectionTitle?.toLowerCase().includes('executive')) {
        bonusScore += 0.1;
      }

      // Boost chunks from early pages (likely more important)
      if (chunk.metadata.page <= 3) {
        bonusScore += 0.05;
      }

      return {
        ...chunk,
        rerankScore: chunk.score + bonusScore,
      };
    });

    // Sort by new score and take top K
    const finalResults = reranked
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);

    return {
      query,
      chunks: finalResults,
      totalResults: initialResults.totalResults,
    };
  } catch (error) {
    console.error('Reranking error:', error);
    throw new Error(`Failed to retrieve and rerank: ${error.message}`);
  }
};

/**
 * Get all chunks from a document for outline generation
 */
export const getAllDocumentChunks = async (documentId) => {
  try {
    const collectionName = toCollectionName(documentId);
    const chunks = await getDocumentChunks(collectionName, documentId);

    return {
      documentId,
      chunks,
      totalChunks: chunks.length,
    };
  } catch (error) {
    console.error('Get all chunks error:', error);
    throw new Error(`Failed to get document chunks: ${error.message}`);
  }
};

/**
 * Multi-query retrieval for complex questions
 */
export const multiQueryRetrieval = async (queries, documentIds, topKPerQuery = 5) => {
  try {
    const allChunks = [];
    const uniqueChunkIds = new Set();

    for (const query of queries) {
      const results = await retrieveRelevantChunks(query, documentIds, topKPerQuery);
      
      // Add unique chunks only
      for (const chunk of results.chunks) {
        if (!uniqueChunkIds.has(chunk.id)) {
          uniqueChunkIds.add(chunk.id);
          allChunks.push(chunk);
        }
      }
    }

    // Sort by score
    const sortedChunks = allChunks.sort((a, b) => b.score - a.score);

    return {
      queries,
      chunks: sortedChunks,
      totalUnique: allChunks.length,
    };
  } catch (error) {
    console.error('Multi-query retrieval error:', error);
    throw new Error(`Failed multi-query retrieval: ${error.message}`);
  }
};

/**
 * Get context window for generation (smart chunk selection)
 */
export const buildContextWindow = async (query, documentIds, maxTokens = 4000) => {
  try {
    // Retrieve relevant chunks
    const results = await retrieveAndRerank(query, documentIds, 15);

    // Build context staying within token limit
    const contextChunks = [];
    let currentTokens = 0;
    const avgTokensPerWord = 1.3; // Approximate

    for (const chunk of results.chunks) {
      const estimatedTokens = Math.ceil(chunk.text.split(/\s+/).length * avgTokensPerWord);
      
      if (currentTokens + estimatedTokens > maxTokens) {
        break;
      }

      contextChunks.push(chunk);
      currentTokens += estimatedTokens;
    }

    return {
      query,
      chunks: contextChunks,
      estimatedTokens: currentTokens,
      truncated: contextChunks.length < results.chunks.length,
    };
  } catch (error) {
    console.error('Context window building error:', error);
    throw new Error(`Failed to build context window: ${error.message}`);
  }
};

/**
 * Extract key-value pairs from retrieved chunks (heuristic)
 */
export const extractKeyValuePairsFromChunks = (chunks = []) => {
  const kvs = [];
  const seen = new Set();
  const add = (key, value, source) => {
    const k = String(key || '').trim();
    const v = String(value || '').trim();
    if (!k || !v) return;
    const sig = `${k}::${v}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    kvs.push({ key: k, value: v, source });
  };

  const keyValuePattern = /([A-Za-z0-9][A-Za-z0-9 ._\\/()&-]{1,80})\s*[:=]\s*([^\n]{1,200})/g;
  const bulletPattern = /[-•]\s*([^:]{2,60})\s*[:=]\s*([^\n]{1,200})/g;
  const lineKeyValue = /^(.{2,80}?)\s*[:=]\s*(.{1,200})$/;
  const lineDash = /^(.{2,80}?)\s*[–—-]\s*(.{1,200})$/;

  chunks.forEach((chunk, idx) => {
    const text = String(chunk.text || chunk.content || '');
    let match;
    while ((match = keyValuePattern.exec(text))) {
      add(match[1], match[2], idx);
    }
    while ((match = bulletPattern.exec(text))) {
      add(match[1], match[2], idx);
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      let parsed = line.match(lineKeyValue);
      if (parsed) {
        add(parsed[1], parsed[2], idx);
        return;
      }
      parsed = line.match(lineDash);
      if (parsed) {
        add(parsed[1], parsed[2], idx);
        return;
      }
      const tabSplit = line.split(/\t+/).map((part) => part.trim()).filter(Boolean);
      if (tabSplit.length >= 2 && tabSplit[0].length <= 80) {
        add(tabSplit[0], tabSplit.slice(1).join(' '), idx);
        return;
      }
      const spaceSplit = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
      if (spaceSplit.length >= 2 && spaceSplit[0].length <= 80) {
        add(spaceSplit[0], spaceSplit.slice(1).join(' '), idx);
      }
    });
  });

  return kvs;
};

/**
 * Generate diverse chunks for outline creation
 */
export const getDiverseChunks = async (documentId, samplingStrategy = 'distributed') => {
  try {
    const allChunks = await getAllDocumentChunks(documentId);

    if (samplingStrategy === 'distributed') {
      // Sample chunks evenly throughout document
      const interval = Math.max(1, Math.floor(allChunks.chunks.length / 20));
      const sampledChunks = allChunks.chunks.filter((_, idx) => idx % interval === 0);
      
      return {
        documentId,
        chunks: sampledChunks,
        strategy: 'distributed',
        totalChunks: allChunks.totalChunks,
      };
    } else if (samplingStrategy === 'priority') {
      // Prioritize beginning, key sections, and end
      const beginning = allChunks.chunks.slice(0, 10);
      const end = allChunks.chunks.slice(-5);
      const middle = allChunks.chunks.slice(10, -5)
        .filter(chunk => 
          chunk.metadata.sectionTitle?.toLowerCase().includes('key') ||
          chunk.metadata.sectionTitle?.toLowerCase().includes('important') ||
          chunk.metadata.sectionTitle?.toLowerCase().includes('summary')
        );

      return {
        documentId,
        chunks: [...beginning, ...middle, ...end],
        strategy: 'priority',
        totalChunks: allChunks.totalChunks,
      };
    }

    return allChunks;
  } catch (error) {
    console.error('Diverse chunks sampling error:', error);
    throw new Error(`Failed to sample diverse chunks: ${error.message}`);
  }
};

export default {
  indexDocument,
  indexTabularDocument,
  retrieveRelevantChunks,
  retrieveAndRerank,
  getAllDocumentChunks,
  multiQueryRetrieval,
  buildContextWindow,
  getDiverseChunks,
  extractKeyValuePairsFromChunks,
};
