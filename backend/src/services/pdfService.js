// backend/src/services/pdfService.js
import pdf from 'pdf-parse';
import fs from 'fs/promises';

/**
 * Chunk text into smaller pieces with overlap
 */
const chunkText = (text, chunkSize = 1000, overlap = 100) => {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  let currentSize = 0;
  
  for (const sentence of sentences) {
    const sentenceSize = sentence.split(/\s+/).length;
    
    if (currentSize + sentenceSize > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Keep overlap from previous chunk
      const words = currentChunk.split(/\s+/);
      currentChunk = words.slice(-overlap).join(' ') + ' ';
      currentSize = overlap;
    }
    
    currentChunk += sentence + ' ';
    currentSize += sentenceSize;
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

/**
 * Extract sections from text based on common patterns
 */
const extractSections = (text) => {
  const sections = [];
  
  // Common section headers patterns
  const headerPatterns = [
    /^#{1,3}\s+(.+)$/gm,           // Markdown headers
    /^([A-Z][A-Za-z\s]+):\s*$/gm,  // Title Case with colon
    /^\d+\.\s+([A-Z].+)$/gm,       // Numbered sections
  ];
  
  let lastIndex = 0;
  let currentSection = { title: 'Introduction', content: '' };
  
  for (const pattern of headerPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (currentSection.content) {
        sections.push(currentSection);
      }
      
      currentSection = {
        title: match[1].trim(),
        content: '',
        startIndex: match.index,
      };
      
      lastIndex = match.index;
    }
  }
  
  // If no sections found, treat entire text as one section
  if (sections.length === 0) {
    return [{
      title: 'Document Content',
      content: text,
      startIndex: 0,
    }];
  }
  
  return sections;
};

/**
 * Parse PDF and extract structured text
 */
export const parsePDF = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
      metadata: {
        title: data.info?.Title || 'Untitled',
        author: data.info?.Author || 'Unknown',
        creationDate: data.info?.CreationDate || null,
      },
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

/**
 * Process PDF into chunks with metadata
 */
export const processPDFToChunks = async (filePath, options = {}) => {
  try {
    const {
      chunkSize = 1000,
      overlap = 100,
      extractSectionsFlag = true,
    } = options;

    // Parse PDF
    const pdfData = await parsePDF(filePath);
    
    // Extract sections if enabled
    let sections = [];
    if (extractSectionsFlag) {
      sections = extractSections(pdfData.text);
    } else {
      sections = [{
        title: 'Content',
        content: pdfData.text,
        startIndex: 0,
      }];
    }

    // Chunk each section
    const allChunks = [];
    let globalChunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = chunkText(section.content, chunkSize, overlap);
      
      for (let i = 0; i < sectionChunks.length; i++) {
        allChunks.push({
          text: sectionChunks[i],
          metadata: {
            chunkIndex: globalChunkIndex++,
            sectionTitle: section.title,
            sectionChunkIndex: i,
            totalSectionChunks: sectionChunks.length,
            page: Math.floor((section.startIndex / pdfData.text.length) * pdfData.numPages) + 1,
          },
        });
      }
    }

    return {
      chunks: allChunks,
      totalChunks: allChunks.length,
      numPages: pdfData.numPages,
      metadata: pdfData.metadata,
      sections: sections.map(s => ({
        title: s.title,
        chunkCount: chunkText(s.content, chunkSize, overlap).length,
      })),
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
};

/**
 * Extract key information from PDF for summary
 */
export const extractKeyInfo = async (filePath) => {
  try {
    const pdfData = await parsePDF(filePath);
    const text = pdfData.text;

    // Extract potential key information
    const keyInfo = {
      title: pdfData.metadata.title,
      author: pdfData.metadata.author,
      numPages: pdfData.numPages,
      wordCount: text.split(/\s+/).length,
      
      // Extract emails
      emails: [...new Set(text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [])],
      
      // Extract URLs
      urls: [...new Set(text.match(/https?:\/\/[^\s]+/g) || [])],
      
      // Extract dates
      dates: [...new Set(text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g) || [])],
      
      // Extract numbers (potential metrics)
      numbers: [...new Set(text.match(/\$?[\d,]+\.?\d*%?/g) || [])].slice(0, 20),
      
      // Extract section headers
      sections: extractSections(text).map(s => s.title),
      
      // Get first 500 characters as preview
      preview: text.substring(0, 500) + '...',
    };

    return keyInfo;
  } catch (error) {
    console.error('Key info extraction error:', error);
    throw new Error(`Failed to extract key info: ${error.message}`);
  }
};

/**
 * Validate PDF file
 */
export const validatePDF = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    
    // Check file size (max configured)
    const maxSize = Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`,
      };
    }

    // Try to parse PDF
    await parsePDF(filePath);

    return {
      valid: true,
      size: stats.size,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};

/**
 * Get PDF page content by page number
 */
export const getPDFPage = async (filePath, pageNumber) => {
  try {
    const pdfData = await parsePDF(filePath);
    
    if (pageNumber < 1 || pageNumber > pdfData.numPages) {
      throw new Error(`Invalid page number. Document has ${pdfData.numPages} pages.`);
    }

    // Approximate page content (pdf-parse doesn't support per-page extraction natively)
    const textPerPage = Math.ceil(pdfData.text.length / pdfData.numPages);
    const startIndex = (pageNumber - 1) * textPerPage;
    const endIndex = startIndex + textPerPage;
    
    return {
      pageNumber,
      content: pdfData.text.substring(startIndex, endIndex),
      totalPages: pdfData.numPages,
    };
  } catch (error) {
    console.error('Page extraction error:', error);
    throw new Error(`Failed to extract page: ${error.message}`);
  }
};

export default {
  parsePDF,
  processPDFToChunks,
  extractKeyInfo,
  validatePDF,
  getPDFPage,
};
