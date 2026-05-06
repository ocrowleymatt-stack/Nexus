/**
 * fileParser.js — Universal file content extractor for Nexus intelligence engine.
 *
 * Supports:
 *   Text:    .txt, .md, .json, .xml, .html, .htm, .log, .yaml, .yml, .toml, .ini, .cfg, .conf
 *   Data:    .csv, .tsv, .xls, .xlsx, .ods
 *   Docs:    .pdf, .docx, .doc, .rtf, .odt, .pptx, .ppt
 *   Code:    .js, .ts, .py, .java, .c, .cpp, .cs, .go, .rb, .php, .swift, .kt, .rs, .sh, .sql
 *   Images:  .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff, .svg (describe via AI vision)
 *   Audio:   .mp3, .wav, .m4a, .ogg, .flac (transcribe via AI)
 *   Video:   .mp4, .mov, .avi, .mkv, .webm (describe via AI vision)
 *   Archives: .zip (already handled by huntZipIntelligence)
 *   Fallback: Any unknown binary — attempt UTF-8 text extraction
 */

import { createRequire } from 'module';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import path from 'path';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ---------------------------------------------------------------------------
// MIME / extension helpers
// ---------------------------------------------------------------------------

const TEXT_EXTS = new Set([
  'txt','md','markdown','json','xml','html','htm','log','yaml','yml',
  'toml','ini','cfg','conf','env','csv','tsv','sql','graphql','gql',
  'js','jsx','ts','tsx','py','java','c','cpp','cc','cs','go','rb',
  'php','swift','kt','rs','sh','bash','zsh','fish','ps1','bat','cmd',
  'r','scala','clj','ex','exs','erl','hs','lua','pl','m','mm','dart',
  'vue','svelte','astro','css','scss','sass','less','styl',
]);

const SPREADSHEET_EXTS = new Set(['csv','tsv','xls','xlsx','ods','numbers']);
const PDF_EXTS = new Set(['pdf']);
const WORD_EXTS = new Set(['docx','doc','odt','rtf']);
const PPTX_EXTS = new Set(['pptx','ppt','odp']);
const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','tiff','tif','svg','ico','heic','heif']);
const AUDIO_EXTS = new Set(['mp3','wav','m4a','ogg','flac','aac','opus','wma']);
const VIDEO_EXTS = new Set(['mp4','mov','avi','mkv','webm','flv','wmv','m4v','3gp']);

function getExt(filename) {
  return path.extname(filename || '').replace('.', '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Extract text from a PDF buffer.
 */
async function parsePdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (e) {
    console.warn('[fileParser] PDF parse failed:', e.message);
    return '';
  }
}

/**
 * Extract text from a DOCX/DOC buffer using mammoth.
 */
async function parseWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (e) {
    console.warn('[fileParser] Word parse failed:', e.message);
    return '';
  }
}

/**
 * Extract text from a spreadsheet (XLS/XLSX/CSV/TSV) buffer.
 */
function parseSpreadsheet(buffer, ext) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = [];
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws);
      if (csv.trim()) sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
    return sheets.join('\n\n');
  } catch (e) {
    console.warn('[fileParser] Spreadsheet parse failed:', e.message);
    // Fallback: treat as raw text
    return buffer.toString('utf8');
  }
}

/**
 * Attempt to extract text from a PPTX buffer using XLSX (it can read OOXML).
 * Falls back to a raw text scan for embedded strings.
 */
async function parsePptx(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const texts = [];
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws);
      if (csv.trim()) texts.push(csv);
    }
    if (texts.length) return texts.join('\n\n');
  } catch (_) {}
  // Fallback: scan buffer for readable ASCII strings
  return extractReadableStrings(buffer);
}

/**
 * For images: return the buffer as base64 so the AI can describe it.
 * The caller is responsible for passing it to a vision-capable model.
 */
function parseImage(buffer, mimeType) {
  return {
    type: 'image',
    base64: buffer.toString('base64'),
    mimeType,
  };
}

/**
 * Scan a binary buffer for readable ASCII/UTF-8 strings (≥ 4 chars).
 * Useful as a last-resort fallback for unknown formats.
 */
function extractReadableStrings(buffer) {
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 500000));
  // Keep printable ASCII runs of length >= 4
  const matches = text.match(/[\x20-\x7E\t\r\n]{4,}/g) || [];
  return matches.join('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse any file buffer into a text string (or image descriptor).
 *
 * @param {Buffer} buffer   - Raw file bytes
 * @param {string} filename - Original filename (used to detect type)
 * @param {string} [mimetype] - MIME type from multipart upload (optional)
 * @returns {Promise<string|{type:'image',base64:string,mimeType:string}>}
 */
export async function parseFileToText(buffer, filename, mimetype = '') {
  const ext = getExt(filename);
  const mime = mimetype.toLowerCase();

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (PDF_EXTS.has(ext) || mime === 'application/pdf') {
    const text = await parsePdf(buffer);
    return text || extractReadableStrings(buffer);
  }

  // ── Word / DOCX ───────────────────────────────────────────────────────────
  if (WORD_EXTS.has(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword') {
    const text = await parseWord(buffer);
    return text || extractReadableStrings(buffer);
  }

  // ── PowerPoint ────────────────────────────────────────────────────────────
  if (PPTX_EXTS.has(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mime === 'application/vnd.ms-powerpoint') {
    return await parsePptx(buffer);
  }

  // ── Spreadsheets (XLS/XLSX — not plain CSV, handled below) ───────────────
  if (['xls','xlsx','ods','numbers'].includes(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel') {
    return parseSpreadsheet(buffer, ext);
  }

  // ── CSV / TSV — plain text, return as-is ─────────────────────────────────
  if (['csv','tsv'].includes(ext) || mime === 'text/csv') {
    return buffer.toString('utf8');
  }

  // ── Images ────────────────────────────────────────────────────────────────
  if (IMAGE_EXTS.has(ext) || mime.startsWith('image/')) {
    const imageMime = mime || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return parseImage(buffer, imageMime);
  }

  // ── Audio / Video — return descriptor so caller can use AI transcription ──
  if (AUDIO_EXTS.has(ext) || mime.startsWith('audio/')) {
    return { type: 'audio', base64: buffer.toString('base64'), mimeType: mime || `audio/${ext}`, filename };
  }
  if (VIDEO_EXTS.has(ext) || mime.startsWith('video/')) {
    return { type: 'video', base64: buffer.toString('base64'), mimeType: mime || `video/${ext}`, filename };
  }

  // ── Plain text / code / markup ────────────────────────────────────────────
  if (TEXT_EXTS.has(ext) || mime.startsWith('text/')) {
    return buffer.toString('utf8');
  }

  // ── ZIP — caller should use huntZipIntelligence ───────────────────────────
  if (ext === 'zip' || mime === 'application/zip') {
    return { type: 'zip', buffer };
  }

  // ── Unknown binary — best-effort readable string extraction ──────────────
  const readable = extractReadableStrings(buffer);
  return readable || buffer.toString('utf8', 0, 50000);
}

/**
 * Determine whether a parsed result is an image/audio/video descriptor
 * (as opposed to a plain text string).
 */
export function isMediaDescriptor(parsed) {
  return parsed && typeof parsed === 'object' && ['image','audio','video','zip'].includes(parsed.type);
}

/**
 * Return true if the file extension is a CSV (needs extractIntelligenceFromCsv).
 */
export function isCsvFile(filename) {
  const ext = getExt(filename);
  return ext === 'csv' || ext === 'tsv';
}

/**
 * Return true if the file is a ZIP archive.
 */
export function isZipFile(filename) {
  return getExt(filename) === 'zip';
}
