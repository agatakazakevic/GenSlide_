import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const buildRowText = (headers, row) =>
  headers
    .map((header, idx) => `${header}: ${normalizeValue(row[idx])}`)
    .filter((pair) => pair !== ': ')
    .join(' | ');

const chunkRows = (rows, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
};

const rowsToChunks = (rows, headers, sheetName = 'Sheet1', chunkSize = 20) => {
  const normalizedHeaders = headers.map((header, idx) => normalizeValue(header) || `Column ${idx + 1}`);
  const rowChunks = chunkRows(rows, chunkSize);
  return rowChunks.map((chunk, idx) => {
    const rowStart = idx * chunkSize + 1;
    const rowEnd = rowStart + chunk.length - 1;
    const lines = chunk.map((row) => buildRowText(normalizedHeaders, row));
    return {
      id: `${sheetName}_${rowStart}_${rowEnd}`,
      text: `Sheet: ${sheetName}\nRows ${rowStart}-${rowEnd}\n${lines.join('\n')}`,
      metadata: {
        sheet: sheetName,
        rowStart,
        rowEnd,
        columns: normalizedHeaders,
      },
    };
  });
};

const parseCsvFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const records = parse(raw, {
    skip_empty_lines: true,
  });
  if (!records.length) {
    return { headers: [], rows: [] };
  }
  const headers = records[0];
  const rows = records.slice(1);
  return { headers, rows };
};

const parseXlsxFile = async (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (!rows.length) return { name, headers: [], rows: [] };
    const headers = rows[0];
    return { name, headers, rows: rows.slice(1) };
  });
  return sheets;
};

export const processTabularToChunks = async (filePath, options = {}) => {
  const ext = path.extname(filePath).toLowerCase();
  const chunkSize = options.chunkSize || 20;
  const chunks = [];
  const sheetMeta = [];

  if (ext === '.csv' || ext === '.tsv') {
    const { headers, rows } = await parseCsvFile(filePath);
    chunks.push(...rowsToChunks(rows, headers, 'Data', chunkSize));
    sheetMeta.push({ name: 'Data', rows: rows.length });
  } else {
    const sheets = await parseXlsxFile(filePath);
    sheets.forEach((sheet) => {
      if (!sheet.rows.length) return;
      chunks.push(...rowsToChunks(sheet.rows, sheet.headers, sheet.name, chunkSize));
      sheetMeta.push({ name: sheet.name, rows: sheet.rows.length });
    });
  }

  return {
    chunks,
    totalChunks: chunks.length,
    sheets: sheetMeta,
    totalRows: sheetMeta.reduce((sum, sheet) => sum + sheet.rows, 0),
  };
};

export const extractTabularInfo = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const info = {
    rowCount: 0,
    sheets: [],
    preview: [],
  };

  if (ext === '.csv' || ext === '.tsv') {
    const { headers, rows } = await parseCsvFile(filePath);
    info.rowCount = rows.length;
    info.sheets = [{ name: 'Data', rows: rows.length }];
    info.preview = rows.slice(0, 5).map((row) => buildRowText(headers, row));
    return info;
  }

  const sheets = await parseXlsxFile(filePath);
  let previewSet = false;
  sheets.forEach((sheet) => {
    info.sheets.push({ name: sheet.name, rows: sheet.rows.length });
    info.rowCount += sheet.rows.length;
    if (!previewSet && sheet.rows.length) {
      info.preview = sheet.rows.slice(0, 5).map((row) => buildRowText(sheet.headers, row));
      previewSet = true;
    }
  });

  return info;
};
