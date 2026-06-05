// backend/src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Import controllers
import documentController from './controllers/documentController.js';
import generationController from './controllers/generationController.js';

import wopiController from './controllers/wopiController.js';
import slidespeakRoutes from './routes/slidespeakRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
await fs.mkdir(UPLOAD_DIR, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    const allowedExts = new Set(['.pdf', '.csv', '.tsv', '.xls', '.xlsx']);
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.has(file.mimetype) || allowedExts.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, CSV, or Excel files are allowed'));
  }
});

// Middleware
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:9980')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
  /^http:\/\/host\.docker\.internal(:\d+)?$/.test(origin);
const allowAllCors = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (allowAllCors || !origin || isLocalOrigin(origin) || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Additional routes
app.use('/api/slidespeak', slidespeakRoutes);

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
    },
  });
});

// API Routes

// Document routes
app.post('/api/documents/upload', upload.single('file'), documentController.uploadDocument);
app.post('/api/documents/batch-upload', upload.array('files', 10), documentController.batchUpload);
app.get('/api/documents', documentController.listDocuments);
app.get('/api/documents/:id', documentController.getDocument);
app.delete('/api/documents/:id', documentController.deleteDocument);
app.post('/api/documents/:id/analyze', documentController.analyzeDocument);
app.get('/api/documents/:id/preview', documentController.getDocumentPreview);

// Generation routes
app.post('/api/generate/outline', generationController.createOutline);
app.post('/api/generate/chart-edit', generationController.editChart);
app.post('/api/generate/auto-chart', generationController.autoGenerateCharts);

// WOPI endpoints for Collabora
app.get('/api/wopi/files/:filename', wopiController.getFileInfo);
app.get('/api/wopi/files/:filename/contents', wopiController.getFileContents);
app.post(
  '/api/wopi/files/:filename/contents',
  express.raw({ type: '*/*', limit: '200mb' }),
  wopiController.putFileContents
);
app.put(
  '/api/wopi/files/:filename/contents',
  express.raw({ type: '*/*', limit: '200mb' }),
  wopiController.putFileContents
);

// Test endpoint for Gemini
app.post('/api/test/gemini', async (req, res) => {
  try {
    const { generateEmbedding } = await import('./services/geminiService.js');
    const embedding = await generateEmbedding('Test text for embedding');
    res.json({
      success: true,
      embeddingSize: embedding.length,
      message: 'Gemini API is working correctly'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀  Snapdeck RAG Backend Server                     ║
║                                                        ║
║   Server:    http://localhost:${PORT}                    ║
║   Health:    http://localhost:${PORT}/health             ║
║   Docs:      http://localhost:${PORT}/api                ║
║                                                        ║
║   Gemini:    ${process.env.GOOGLE_API_KEY ? '✓ Configured' : '✗ Not configured'}                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

export default app;
