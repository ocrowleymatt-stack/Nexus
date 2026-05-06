/**
 * upload.js — Universal file upload route for Nexus.
 *
 * POST /api/upload
 *   Accepts any file via multipart/form-data (field name: "file").
 *   Parses the file content, then routes it to the appropriate AI extractor.
 *   Returns the same JSON shape as /api/ai/extract-csv and /api/ai/extract-text.
 *
 * No file size limit is enforced here — Express body limit is set in index.js.
 */

import express from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import {
  parseFileToText,
  isMediaDescriptor,
  isCsvFile,
  isZipFile,
} from '../utils/fileParser.js';
import {
  extractIntelligenceFromCsv,
  extractIntelligenceFromText,
  huntZipIntelligence,
  callAIWithVision,
} from '../utils/ai.js';

const router = express.Router();

// Store files in memory — no disk I/O needed
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: Infinity }, // No size limit
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a ZIP archive and build the fileTree + fileSamples for huntZipIntelligence.
 */
async function extractZip(buffer, zipName) {
  const zip = await JSZip.loadAsync(buffer);
  const fileTree = [];
  const fileSamples = {};

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    fileTree.push(relativePath);
    // Sample up to 2000 chars from each file
    try {
      const content = await zipEntry.async('string');
      fileSamples[relativePath] = content.substring(0, 2000);
    } catch (_) {
      fileSamples[relativePath] = '[binary file]';
    }
  }

  return { fileTree, fileSamples };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with field name "file".' });
  }

  const { originalname, buffer, mimetype } = req.file;
  console.log(`[UPLOAD] Received: ${originalname} (${mimetype}, ${buffer.length} bytes)`);

  try {
    // ── ZIP ────────────────────────────────────────────────────────────────
    if (isZipFile(originalname) || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed') {
      const { fileTree, fileSamples } = await extractZip(buffer, originalname);
      const result = await huntZipIntelligence(originalname, fileTree, fileSamples);
      return res.json(result);
    }

    // ── Parse file to text (or media descriptor) ──────────────────────────
    const parsed = await parseFileToText(buffer, originalname, mimetype);

    // ── Image / Audio / Video — use AI vision/transcription ───────────────
    if (isMediaDescriptor(parsed)) {
      if (parsed.type === 'image') {
        // Use vision-capable AI to describe the image and extract intelligence
        const result = await callAIWithVision(
          `Analyze this image and extract all investigative intelligence. 
           Identify people, organizations, locations, events, and relationships visible or implied.
           Structure your response as a JSON object with: centralNode, nodes (id, name, type, description), links (source, target, relationship), narrative.`,
          parsed.base64,
          parsed.mimeType
        );
        return res.json(result);
      }
      if (parsed.type === 'audio' || parsed.type === 'video') {
        // Describe the media file using AI
        const result = await callAIWithVision(
          `This is a ${parsed.type} file named "${parsed.filename || originalname}". 
           Based on the filename and any metadata available, extract investigative intelligence.
           Structure your response as a JSON object with: centralNode, nodes (id, name, type, description), links (source, target, relationship), narrative.`,
          parsed.base64,
          parsed.mimeType
        );
        return res.json(result);
      }
    }

    // ── CSV / TSV — use CSV extractor ─────────────────────────────────────
    if (isCsvFile(originalname)) {
      const result = await extractIntelligenceFromCsv(parsed);
      return res.json(result);
    }

    // ── All other text ────────────────────────────────────────────────────
    const textContent = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    const result = await extractIntelligenceFromText(textContent);
    return res.json(result);

  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    res.status(500).json({ error: err.message || 'File intelligence extraction failed.' });
  }
});

export default router;
