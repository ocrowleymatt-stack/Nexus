/**
 * geminiService.ts
 *
 * Unified intelligence extraction service.
 *
 * Strategy:
 *  1. Try the server-side /api/ai/* route (works when the Express server is
 *     running, e.g. local dev or a full Cloud Run deployment).
 *  2. If the server returns a non-JSON response (HTML SPA fallback, 404, etc.)
 *     OR if the fetch itself fails, fall back to calling the Gemini API
 *     directly from the browser via geminiClientService.
 *     On Google AI Studio the service worker transparently proxies those calls.
 *
 * This dual-path approach means the app works in both environments without
 * any configuration changes.
 */

import { SearchResult } from "../types";
import {
  clientDeepSearchEntity,
  clientExtractIntelligenceFromCsv,
  clientExtractIntelligenceFromText,
  clientExtractIntelligenceFromUrl,
  clientHuntZipIntelligence,
  clientExpandGraph,
  clientForensicSearchNode,
  clientTestHypothesis,
} from "./geminiClientService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a fetch Response as JSON.
 * Returns null (instead of throwing) when the body is not valid JSON so the
 * caller can decide to fall back to the client-side path.
 */
async function tryServerJson(response: Response): Promise<any | null> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * POST to a server-side API route and return the parsed JSON.
 * Returns null if the server is unavailable or returns non-JSON (e.g. the
 * SPA HTML fallback that Google AI Studio serves for unknown routes).
 */
async function tryServer(path: string, body: object): Promise<any | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await tryServerJson(response);
    if (data === null) return null; // non-JSON response
    if (!response.ok) {
      // Server returned a JSON error — surface it so the caller can throw
      throw new Error(data?.error || `Server error ${response.status}`);
    }
    return data;
  } catch (err: any) {
    // Network error or non-JSON — signal "no server available"
    if (err.message?.startsWith("Server error")) throw err;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  const data = await tryServer("/api/ai/deep-search", { entityName });
  if (data !== null) return data;
  return clientDeepSearchEntity(entityName);
}

export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  const data = await tryServer("/api/ai/extract-csv", { csvContent });
  if (data !== null) return data;
  return clientExtractIntelligenceFromCsv(csvContent);
}

export async function forensicSearchNode(entityName: string): Promise<string> {
  const data = await tryServer("/api/ai/forensic-search", { entityName });
  if (data !== null) return data.text;
  return clientForensicSearchNode(entityName);
}

export async function testHypothesis(
  hypothesis: string,
  contextNodes: string[]
): Promise<string> {
  const data = await tryServer("/api/ai/test-hypothesis", { hypothesis, contextNodes });
  if (data !== null) return data.text;
  return clientTestHypothesis(hypothesis, contextNodes);
}

export async function expandGraph(existingData: SearchResult): Promise<SearchResult> {
  const data = await tryServer("/api/ai/expand-graph", { existingData });
  if (data !== null) return data;
  return clientExpandGraph(existingData);
}

export async function extractIntelligenceFromText(text: string): Promise<SearchResult> {
  const data = await tryServer("/api/ai/extract-text", { text });
  if (data !== null) return data;
  return clientExtractIntelligenceFromText(text);
}

export async function extractIntelligenceFromUrl(url: string): Promise<SearchResult> {
  const data = await tryServer("/api/ai/extract-url", { url });
  if (data !== null) return data;
  return clientExtractIntelligenceFromUrl(url);
}

export async function huntZipIntelligence(
  zipName: string,
  fileTree: string[],
  fileSamples: { [path: string]: string }
): Promise<SearchResult> {
  const data = await tryServer("/api/ai/hunt-zip", { zipName, fileTree, fileSamples });
  if (data !== null) return data;
  return clientHuntZipIntelligence(zipName, fileTree, fileSamples);
}

export async function veniceSensemaking(existingData: SearchResult): Promise<SearchResult> {
  // Venice sensemaking has no client-side equivalent — try server only
  const data = await tryServer("/api/ai/venice-clean", { existingData });
  if (data !== null) return data;
  // Graceful degradation: return the existing data unchanged
  throw new Error(
    "Venice Sensemaking requires the server-side Venice API key. " +
    "Please ensure VENICE_API_KEY is configured in your deployment."
  );
}
