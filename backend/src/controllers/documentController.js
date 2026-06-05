// backend/src/controllers/documentController.js
import path from 'path';
import fs from 'fs/promises';
import { indexDocument, indexTabularDocument } from '../services/ragService.js';
import { extractKeyInfo, validatePDF } from '../services/pdfService.js';
import { extractTabularInfo } from '../services/tabularService.js';
import { generateOutline } from '../services/geminiService.js';
import { getDiverseChunks } from '../services/ragService.js';

// Simple in-memory store (replace with actual DB in production)
let documentsStore = [];

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Upload and index PDF document
 */
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const documentId = `doc_${Date.now()}`;
    const filePath = file.path;
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdf = ext === '.pdf' || file.mimetype === 'application/pdf';
    const isTabular = ['.csv', '.tsv', '.xlsx', '.xls'].includes(ext);

    if (!isPdf && !isTabular) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    let indexResult = null;
    let keyInfo = null;
    let tabularInfo = null;

    if (isPdf) {
      const validation = await validatePDF(filePath);
      if (!validation.valid) {
        await fs.unlink(filePath);
        return res.status(400).json({ error: validation.error });
      }
      keyInfo = await extractKeyInfo(filePath);
      indexResult = await indexDocument(filePath, documentId, file.originalname);
    } else {
      tabularInfo = await extractTabularInfo(filePath);
      indexResult = await indexTabularDocument(filePath, documentId, file.originalname);
    }

    // Store metadata
    const documentMeta = {
      id: documentId,
      filename: file.originalname,
      filepath: filePath,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      fileType: isPdf ? 'pdf' : 'tabular',
      numPages: indexResult.numPages,
      chunksIndexed: indexResult.chunksIndexed,
      collectionName: indexResult.collectionName,
      sections: indexResult.sections,
      keyInfo: keyInfo
        ? {
            wordCount: keyInfo.wordCount,
            sections: keyInfo.sections,
            preview: keyInfo.preview,
          }
        : undefined,
      tabularInfo: tabularInfo
        ? {
            rowCount: tabularInfo.rowCount,
            sheets: tabularInfo.sheets,
            preview: tabularInfo.preview,
          }
        : undefined,
    };

    documentsStore.push(documentMeta);

    res.status(201).json({
      success: true,
      message: 'Document uploaded and indexed successfully',
      document: documentMeta,
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file on error
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Failed to upload document',
      message: error.message,
    });
  }
};

/**
 * List all uploaded documents
 */
export const listDocuments = async (req, res) => {
  try {
    const documents = documentsStore.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      fileType: doc.fileType,
      numPages: doc.numPages,
      rowCount: doc.tabularInfo?.rowCount,
      chunksIndexed: doc.chunksIndexed,
      sections: doc.sections,
    }));

    res.json({
      success: true,
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
};

/**
 * Get document details
 */
export const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = documentsStore.find(doc => doc.id === id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
};

/**
 * Delete document
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const docIndex = documentsStore.findIndex(doc => doc.id === id);

    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documentsStore[docIndex];

    // Delete file
    try {
      await fs.unlink(document.filepath);
    } catch (error) {
      console.error('File deletion error:', error);
    }

    // Remove from store
    documentsStore.splice(docIndex, 1);

    // Note: In production, also delete from vector store if persisted

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

/**
 * Auto-analyze document and generate outline
 */
export const analyzeDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { userPrompt, deckType, slideCount } = req.body;

    const document = documentsStore.find(doc => doc.id === id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get diverse chunks for outline generation
    const chunksResult = await getDiverseChunks(id, 'priority');

    // Generate outline using Gemini
    const outline = await generateOutline(chunksResult.chunks, userPrompt, deckType, slideCount);

    res.json({
      success: true,
      documentId: id,
      outline,
      chunksAnalyzed: chunksResult.chunks.length,
    });
  } catch (error) {
    console.error('Analyze document error:', error);
    res.status(500).json({
      error: 'Failed to analyze document',
      message: error.message,
    });
  }
};

/**
 * Get document preview/summary
 */
export const getDocumentPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const document = documentsStore.find(doc => doc.id === id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      success: true,
      preview: {
        filename: document.filename,
        numPages: document.numPages,
        sections: document.sections,
        wordCount: document.keyInfo?.wordCount,
        preview: document.keyInfo?.preview || document.tabularInfo?.preview,
      },
    });
  } catch (error) {
    console.error('Get preview error:', error);
    res.status(500).json({ error: 'Failed to get preview' });
  }
};

/**
 * Batch upload multiple documents
 */
export const batchUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const filePath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();
        const isPdf = ext === '.pdf' || file.mimetype === 'application/pdf';
        const isTabular = ['.csv', '.tsv', '.xlsx', '.xls'].includes(ext);

        if (!isPdf && !isTabular) {
          await fs.unlink(filePath);
          errors.push({ filename: file.originalname, error: 'Unsupported file type' });
          continue;
        }

        let indexResult = null;
        let keyInfo = null;
        let tabularInfo = null;

        if (isPdf) {
          const validation = await validatePDF(filePath);
          if (!validation.valid) {
            await fs.unlink(filePath);
            errors.push({ filename: file.originalname, error: validation.error });
            continue;
          }
          keyInfo = await extractKeyInfo(filePath);
          indexResult = await indexDocument(filePath, documentId, file.originalname);
        } else {
          tabularInfo = await extractTabularInfo(filePath);
          indexResult = await indexTabularDocument(filePath, documentId, file.originalname);
        }

        const documentMeta = {
          id: documentId,
          filename: file.originalname,
          filepath: filePath,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          fileType: isPdf ? 'pdf' : 'tabular',
          numPages: indexResult.numPages,
          chunksIndexed: indexResult.chunksIndexed,
          collectionName: indexResult.collectionName,
          sections: indexResult.sections,
          keyInfo: keyInfo
            ? {
                wordCount: keyInfo.wordCount,
                sections: keyInfo.sections,
                preview: keyInfo.preview,
              }
            : undefined,
          tabularInfo: tabularInfo
            ? {
                rowCount: tabularInfo.rowCount,
                sheets: tabularInfo.sheets,
                preview: tabularInfo.preview,
              }
            : undefined,
        };

        documentsStore.push(documentMeta);
        results.push(documentMeta);
      } catch (error) {
        errors.push({ filename: file.originalname, error: error.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Uploaded ${results.length} documents`,
      documents: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({ error: 'Failed to batch upload documents' });
  }
};

export default {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  analyzeDocument,
  getDocumentPreview,
  batchUpload,
};
