import express from 'express';
import multer from 'multer';
import path from 'path';
import documentController from '../controllers/documentController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10485760 },
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

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/', documentController.listDocuments);
router.get('/:id', documentController.getDocument);
router.delete('/:id', documentController.deleteDocument);

export default router;
