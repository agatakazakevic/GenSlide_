// ============================================
// FILE: backend/src/routes/generationRoutes.js
// ============================================
import express from 'express';
import generationController from '../controllers/generationController.js';

const router = express.Router();

router.post('/outline', generationController.createOutline);
router.post('/deck-from-prompt', generationController.generateFromPrompt);
router.post('/image', generationController.generateImage);
router.post('/images', generationController.batchGenerateImages);
router.post('/chart-edit', generationController.editChart);

export default router;
