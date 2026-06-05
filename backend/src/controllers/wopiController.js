// backend/src/controllers/wopiController.js
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const WOPI_SECRET = process.env.WOPI_SECRET || 'local-dev';

const resolveFilePath = (filename) => path.join(process.cwd(), UPLOAD_DIR, filename);

const isAuthorized = (req) => {
  const token = req.query.access_token || req.headers['x-wopi-token'];
  return token === WOPI_SECRET;
};

export const getFileInfo = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { filename } = req.params;
    const filepath = resolveFilePath(filename);
    const stat = await fs.stat(filepath);

    return res.json({
      BaseFileName: filename,
      Size: stat.size,
      OwnerId: 'snapdeck',
      UserId: 'snapdeck-user',
      UserFriendlyName: 'Snapdeck User',
      Version: String(stat.mtimeMs),
      SupportsUpdate: true,
      UserCanWrite: true,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('WOPI file info error:', error);
    return res.status(500).json({ error: 'Failed to load file info' });
  }
};

export const getFileContents = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { filename } = req.params;
    const filepath = resolveFilePath(filename);
    const buffer = await fs.readFile(filepath);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    return res.send(buffer);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('WOPI file contents error:', error);
    return res.status(500).json({ error: 'Failed to load file' });
  }
};

export const putFileContents = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { filename } = req.params;
    const filepath = resolveFilePath(filename);
    await fs.writeFile(filepath, req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('WOPI save error:', error);
    return res.status(500).json({ error: 'Failed to save file' });
  }
};

export default {
  getFileInfo,
  getFileContents,
  putFileContents,
};
