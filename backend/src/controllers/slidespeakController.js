import axios from 'axios';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { pipeline } from 'stream/promises';
import { buildContextWindow, extractKeyValuePairsFromChunks } from '../services/ragService.js';
import {
  createPresentation,
  getTaskStatus,
  getDownloadUrl,
  listTemplates,
} from '../services/slidespeakService.js';

const formatAxiosError = (error) => {
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data?.message || error.response.statusText,
      details: error.response.data,
    };
  }

  return {
    status: 500,
    message: error.message || 'Unexpected SlideSpeak error',
  };
};

const resolveDownloadUrl = (payload) =>
  payload?.url ||
  payload?.download_url ||
  payload?.data?.url ||
  payload?.data?.download_url ||
  '';

const webhookStore = new Map();

const extractWebhookPayload = (body = {}) => {
  const taskId = body.task_id || body.taskId || body.id || '';
  const taskStatus = body.task_status || body.taskStatus || body.status || '';
  const requestId =
    body.request_id ||
    body.requestId ||
    body.task_result?.request_id ||
    body.task_result?.id ||
    body.request?.id ||
    '';
  return { taskId, taskStatus, requestId, raw: body };
};

export const generatePresentation = async (req, res) => {
  try {
    const {
      plainText,
      document_uuids,
      length,
      template = 'default',
      language,
      fetch_images,
      use_document_images,
      tone,
      verbosity,
      custom_user_instructions,
      include_cover,
      include_table_of_contents,
      add_speaker_notes,
      use_general_knowledge,
      use_wording_from_document,
      use_branding_logo,
      use_branding_fonts,
      use_branding_color,
      branding_logo,
      branding_fonts,
      branding_color,
      run_sync,
      response_format,
    } = req.body || {};
    const hasPlainText = Boolean(plainText && String(plainText).trim());
    if (!hasPlainText) {
      return res.status(400).json({ error: 'plainText is required' });
    }

    const result = await createPresentation({
      plainText: plainText.trim(),
      document_uuids,
      length,
      template,
      language,
      fetch_images,
      use_document_images,
      tone,
      verbosity,
      custom_user_instructions,
      include_cover,
      include_table_of_contents,
      add_speaker_notes,
      use_general_knowledge,
      use_wording_from_document,
      use_branding_logo,
      use_branding_fonts,
      use_branding_color,
      branding_logo,
      branding_fonts,
      branding_color,
      run_sync,
      response_format,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const formatted = formatAxiosError(error);
    console.error('SlideSpeak generate error:', error);
    return res.status(formatted.status).json({
      error: 'Failed to generate presentation',
      message: formatted.message,
      details: formatted.details,
    });
  }
};

export const receiveWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const { taskId, taskStatus, requestId } = extractWebhookPayload(payload);
    if (!taskId) {
      return res.status(400).json({ error: 'task_id is required in webhook payload' });
    }
    webhookStore.set(String(taskId), {
      taskId: String(taskId),
      taskStatus: taskStatus || 'UNKNOWN',
      requestId: requestId || '',
      receivedAt: new Date().toISOString(),
      payload,
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Webhook handling failed', message: error.message });
  }
};

export const getWebhookStatus = async (req, res) => {
  const { taskId } = req.params;
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });
  const entry = webhookStore.get(String(taskId));
  if (!entry) return res.status(404).json({ error: 'No webhook data found for task' });
  return res.json({ success: true, data: entry });
};

export const fetchTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    const result = await getTaskStatus(taskId);
    return res.json({ success: true, data: result });
  } catch (error) {
    const formatted = formatAxiosError(error);
    console.error('SlideSpeak task status error:', error);
    return res.status(formatted.status).json({
      error: 'Failed to fetch task status',
      message: formatted.message,
      details: formatted.details,
    });
  }
};

export const fetchDownloadUrl = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const result = await getDownloadUrl(requestId);
    return res.json({ success: true, data: result });
  } catch (error) {
    const formatted = formatAxiosError(error);
    console.error('SlideSpeak download error:', error);
    return res.status(formatted.status).json({
      error: 'Failed to fetch download URL',
      message: formatted.message,
      details: formatted.details,
    });
  }
};

export const fetchTemplates = async (req, res) => {
  try {
    if (!process.env.SLIDESPEAK_API_KEY) {
      return res.json({ success: true, templates: [] });
    }
    const templates = await listTemplates();
    return res.json({ success: true, templates });
  } catch (error) {
    const formatted = formatAxiosError(error);
    console.error('SlideSpeak templates error:', error);
    return res.status(formatted.status).json({
      error: 'Failed to fetch SlideSpeak templates',
      message: formatted.message,
      details: formatted.details,
    });
  }
};

export const fetchKnowledgeContext = async (req, res) => {
  try {
    const { query, documentIds, maxTokens = 1200 } = req.body || {};
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds are required' });
    }

    const context = await buildContextWindow(String(query), documentIds, Number(maxTokens) || 1200);
    return res.json({
      success: true,
      chunks: context.chunks || [],
      estimatedTokens: context.estimatedTokens || 0,
      truncated: context.truncated || false,
    });
  } catch (error) {
    console.error('SlideSpeak knowledge error:', error);
    return res.status(500).json({
      error: 'Failed to build knowledge context',
      message: error.message,
    });
  }
};

export const extractKnowledgeKeyValues = async (req, res) => {
  try {
    const { query, documentIds, maxTokens = 1200 } = req.body || {};
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds are required' });
    }

    const context = await buildContextWindow(String(query), documentIds, Number(maxTokens) || 1200);
    const keyValues = extractKeyValuePairsFromChunks(context.chunks || []);
    const outputName = `rag_kv_${Date.now()}.json`;
    const outputPath = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', outputName);
    await fsPromises.writeFile(outputPath, JSON.stringify(keyValues, null, 2), 'utf-8');

    return res.json({
      success: true,
      filename: outputName,
      downloadUrl: `/api/workflow/download/${outputName}`,
      keyValues,
    });
  } catch (error) {
    console.error('RAG key-value extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract key-value pairs',
      message: error.message,
    });
  }
};

export const insertChartImage = async (req, res) => {
  try {
    const { filename, slideIndex, imageData, frame } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required' });
    }
    if (slideIndex === undefined || slideIndex === null) {
      return res.status(400).json({ error: 'slideIndex is required' });
    }

    const safeName = path.basename(String(filename));
    const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const pptxPath = path.join(uploadsDir, safeName);

    if (!fs.existsSync(pptxPath)) {
      return res.status(404).json({ error: 'PPTX not found' });
    }

    const match = String(imageData).match(/^data:image\/png;base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'imageData must be a base64 PNG data URL' });
    }

    const buffer = Buffer.from(match[1], 'base64');
    const tempImageName = `chart_${Date.now()}.png`;
    const tempImagePath = path.join(uploadsDir, tempImageName);
    await fsPromises.writeFile(tempImagePath, buffer);

    const outputFilename = `slidespeak_${Date.now()}_edited.pptx`;
    const outputPath = path.join(uploadsDir, outputFilename);

    const percent = (value, fallback) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const x = percent(frame?.x, 8);
    const y = percent(frame?.y, 22);
    const w = percent(frame?.w, 60);
    const h = percent(frame?.h, 40);

    const scriptPath = path.resolve(process.cwd(), 'backend', 'scripts', 'insert_pptx_image.py');
    await new Promise((resolve, reject) => {
      execFile(
        'python3',
        [
          scriptPath,
          '--pptx',
          pptxPath,
          '--output',
          outputPath,
          '--slide',
          String(Number(slideIndex)),
          '--image',
          tempImagePath,
          '--x',
          String(x),
          '--y',
          String(y),
          '--w',
          String(w),
          '--h',
          String(h),
        ],
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });

    await fsPromises.unlink(tempImagePath).catch(() => {});

    return res.json({
      success: true,
      filename: outputFilename,
      downloadUrl: `/api/workflow/download/${outputFilename}`,
    });
  } catch (error) {
    console.error('SlideSpeak insert chart error:', error);
    return res.status(500).json({
      error: 'Failed to insert chart into PPTX',
      message: error.message,
    });
  }
};

export const getPreviewImages = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const safeName = path.basename(String(filename));
    const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const pptxPath = path.join(uploadsDir, safeName);

    if (!fs.existsSync(pptxPath)) {
      return res.status(404).json({ error: 'PPTX not found' });
    }

    const baseName = safeName.replace(/\.pptx$/i, '');
    const prefix = `${baseName}_slide_`;
    const files = await fsPromises.readdir(uploadsDir);
    const existingSlides = files
      .filter((file) => file.startsWith(prefix) && file.toLowerCase().endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let slideImages = existingSlides;
    if (slideImages.length === 0) {
      const tempDir = await fsPromises.mkdtemp(path.join(uploadsDir, `${baseName}_tmp_`));
      await new Promise((resolve, reject) => {
        execFile(
          'soffice',
          ['--headless', '--convert-to', 'png', '--outdir', tempDir, pptxPath],
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || error.message));
              return;
            }
            resolve();
          }
        );
      });

      const converted = (await fsPromises.readdir(tempDir))
        .filter((file) => file.toLowerCase().endsWith('.png'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      slideImages = [];
      for (let i = 0; i < converted.length; i += 1) {
        const source = path.join(tempDir, converted[i]);
        const targetName = `${prefix}${i + 1}.png`;
        const targetPath = path.join(uploadsDir, targetName);
        await fsPromises.copyFile(source, targetPath);
        slideImages.push(targetName);
      }

      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    const imageUrls = slideImages.map((file) => `/api/slidespeak/preview-file/${file}`);
    return res.json({ success: true, images: imageUrls });
  } catch (error) {
    console.error('SlideSpeak preview error:', error);
    return res.status(500).json({
      error: 'Failed to generate PPTX preview images',
      message: error.message,
    });
  }
};

export const servePreviewFile = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const safeName = path.basename(String(filename));
    const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const filePath = path.join(uploadsDir, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to serve preview file', message: error.message });
  }
};

export const importPresentationFromRequest = async (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const downloadInfo = await getDownloadUrl(requestId);
    const fileUrl = resolveDownloadUrl(downloadInfo);
    if (!fileUrl) {
      return res.status(500).json({ error: 'SlideSpeak download URL not found' });
    }

    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    await fsPromises.mkdir(uploadDir, { recursive: true });
    const filename = `slidespeak_${Date.now()}.pptx`;
    const filePath = path.join(uploadDir, filename);

    const fileResponse = await axios.get(fileUrl, { responseType: 'stream', timeout: 120000 });
    await pipeline(fileResponse.data, fs.createWriteStream(filePath));

    return res.json({
      success: true,
      filename,
      downloadUrl: `/api/workflow/download/${filename}`,
    });
  } catch (error) {
    const formatted = formatAxiosError(error);
    console.error('SlideSpeak import error:', error);
    return res.status(formatted.status).json({
      error: 'Failed to import SlideSpeak presentation',
      message: formatted.message,
      details: formatted.details,
    });
  }
};

export default {
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
};
