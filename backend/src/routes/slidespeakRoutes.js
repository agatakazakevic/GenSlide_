import express from 'express';
import {
  generatePresentation,
  fetchTaskStatus,
  fetchDownloadUrl,
  fetchTemplates,
  fetchKnowledgeContext,
  extractKnowledgeKeyValues,
  insertChartImage,
  getPreviewImages,
  servePreviewFile,
  receiveWebhook,
  getWebhookStatus,
  importPresentationFromRequest,
} from '../controllers/slidespeakController.js';

const router = express.Router();

router.post('/generate', generatePresentation);
router.get('/status/:taskId', fetchTaskStatus);
router.get('/download/:requestId', fetchDownloadUrl);
router.get('/templates', fetchTemplates);
router.post('/knowledge', fetchKnowledgeContext);
router.post('/knowledge-kv', extractKnowledgeKeyValues);
router.get('/preview-images/:filename', getPreviewImages);
router.get('/preview-file/:filename', servePreviewFile);
router.post('/webhook', receiveWebhook);
router.get('/webhook-status/:taskId', getWebhookStatus);
router.post('/insert-chart', insertChartImage);
router.post('/import', importPresentationFromRequest);

export default router;
