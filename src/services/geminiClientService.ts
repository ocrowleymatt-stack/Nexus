/**
 * Client-side Gemini AI service.
 *
 * This module calls the Gemini API directly from the browser.
 * When deployed on Google AI Studio, the service worker transparently
 * proxies all calls to generativelanguage.googleapis.com through the
 * platform's secure proxy endpoint — no API key needs to be embedded
 * in the client bundle.
 *
 * When running locally (dev mode), the server-side /api/ai/* routes are
 * used as a fallback so that a GEMINI_API_KEY set in .env is honoured.
 */

import { GoogleGenAI } from "@google/genai";
import { SearchResult } from "../types";

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------
const SEARCH_MODEL = "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// Gemini client initialisation
// ---------------------------------------------------------------------------

/**
 * Resolve the Gemini API key.
 *
 * Google AI Studio injects the key as `process.env.API_KEY` at build time.
 * Locally we fall back to `VITE_GEMINI_API_KEY` in .env.
 * If neither is present we return an empty string; the service worker will
 * still proxy requests correctly when running inside AI Studio.
 */
function getApiKey(): string {
  // AI Studio build-time injection
  if (typeof process !== "undefined" && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  // Vite local dev
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as any).env;
    if (env?.VITE_GEMINI_API_KEY) return env.VITE_GEMINI_API_KEY;
  }
  // No key available — service worker proxy will handle auth
  return "";
}

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const key = getApiKey();
    // GoogleGenAI accepts an empty string; the service worker adds auth headers
    _ai = new GoogleGenAI({ apiKey: key || "placeholder" });
  }
  return _ai;
}

// ---------------------------------------------------------------------------
// JSON parsing helpers (mirrors server-side parseAIJson)
// ---------------------------------------------------------------------------

function parseAIJson(text: string): any {
  if (!text) throw new Error("Empty response from AI");

  let cleaned = text.trim();

  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  } else {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
  }

  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };

  let result = tryParse(cleaned);
  if (result) return result;

  const sanitized = cleaned
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/\[\d+(?:,\s*\d+)*\]/g, "");

  result = tryParse(sanitized);
  if (result) return result;

  const newlineFixed = sanitized.replace(/"([^"]*)"/g, (_m: string, p1: string) =>
    '"' + p1.replace(/\n+/g, "\\n").replace(/\r+/g, "\\r") + '"'
  );

  result = tryParse(newlineFixed);
  if (result) return result;

  throw new Error(
    "Intelligence engine returned malformed data. Please try again."
  );
}

// ---------------------------------------------------------------------------
// Public API — mirrors the server-side functions in server/utils/ai.js
// ---------------------------------------------------------------------------

export async function clientDeepSearchEntity(entityName: string): Promise<SearchResult> {
  const ai = getAI();
  const prompt = `
    Conduct a deep research investigation into the entity: "${entityName}".
    
    1. Identify all key "nodes" (entities, organizations, aliases) connected to this entity.
    2. Characterize each node with a descriptive profile.
    3. Define the specific "links" (relationships) between these nodes.
    4. Write a cohesive investigative narrative that explains the "story" behind these connections.
    
    Structure your response as a JSON object:
    {
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientExtractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  const ai = getAI();
  const prompt = `
    You are a data intelligence analyst. I have provided a raw CSV data dump.
    Your task is to analyze this data and extract a meaningful network map and a narrative summary.
    
    1. Identify the "central subject" of the data.
    2. Identify all related "nodes" (people, organizations, locations).
    3. Define "links" (relationships, transactions, or interactions) between these nodes.
    4. Write a markdown-formatted intelligence report that synthesizes the "narrative" of what's happening based on the data.
    
    Structure your response as a JSON object:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
    
    CSV DATA:
    ${csvContent.substring(0, 30000)}
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientExtractIntelligenceFromText(text: string): Promise<SearchResult> {
  const ai = getAI();
  const prompt = `
    You are a clinical intelligence analyst. Analyze the provided investigative notes.
    
    STRICT MANDATE:
    - Absolutely NO meta-text or fluff.
    - NARRATIVE LIMIT: 300 words.
    
    Structure your response as a JSON object:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
    
    TEXT:
    ${text.substring(0, 20000)}
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientExtractIntelligenceFromUrl(url: string): Promise<SearchResult> {
  const ai = getAI();
  const prompt = `
    Analyze the following URL and extract all investigative intelligence: ${url}
    
    STRICT MANDATE:
    - Use search grounding to fetch and verify the content of the URL if possible.
    - Identify key nodes and links.
    - Narrative limit: 300 words.
    
    Structure your response as a JSON object:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientHuntZipIntelligence(
  zipName: string,
  fileTree: string[],
  fileSamples: { [path: string]: string }
): Promise<SearchResult> {
  const ai = getAI();
  const samplesText = Object.entries(fileSamples)
    .map(([p, content]) => `FILE: ${p}\nCONTENT: ${content.substring(0, 1000)}`)
    .join("\n\n---\n\n");

  const prompt = `
    You are a digital forensic investigator. I have a ZIP archive named "${zipName}".
    Here is the file structure:
    ${fileTree.join("\n")}
    
    And here are samples from key files:
    ${samplesText}
    
    Your task:
    1. Identify the primary subject/person this archive belongs to.
    2. Map out their immediate connections based on metadata, filenames, and file content.
    3. Construct an "Investigative Profile" narrative that summarizes their digital footprint and key affiliations.
    4. Extract nodes and links reflecting these relationships.
    
    Structure your response as a JSON object:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientExpandGraph(existingData: SearchResult): Promise<SearchResult> {
  const ai = getAI();
  const nodeNames = existingData.nodes.map((n: any) => n.name || n.id).join(", ");

  const prompt = `
    You are an intelligence researcher. Deepen the network map: [${nodeNames}].
    
    STRICT MANDATE:
    - High-density clinical output.
    - Identify NEW entities or hidden relationships.
    - NARRATIVE LIMIT: 150 words (NEW findings only).
    
    Structure your response as a JSON object:
    {
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });
  return parseAIJson(response.text ?? "");
}

export async function clientForensicSearchNode(entityName: string): Promise<string> {
  const ai = getAI();
  const prompt = `
    Perform a forensic legal and public records search for the entity: "${entityName}".
    
    FOCUS AREAS:
    1. Civil and criminal court filings.
    2. Regulatory enforcement actions (SEC, FTC, FCA, etc.).
    3. Law enforcement mentions or digital footprint in police-adjacent registers.
    4. Corporate registration history and high-level litigation involvement.
    
    Provide a concise, high-density "Forensic Spotlight" summary in Markdown format.
    If no legal records are found, state "No visible public legal friction detected."
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }] },
  });
  return response.text ?? "";
}

export async function clientTestHypothesis(
  hypothesis: string,
  contextNodes: string[]
): Promise<string> {
  const ai = getAI();
  const prompt = `
    You are an adversarial investigative auditor. STRESS TEST the following hypothesis.
    
    HYPOTHESIS: "${hypothesis}"
    CONTEXT: [${contextNodes.join(", ")}]
    
    STRICT MANDATE:
    - Zero filler or "In this analysis..." language.
    - Markdown only.
    - High-density verification logic.
    
    SECTIONS:
    - PROOF: Data verifying the theory.
    - CONTRADICTIONS: Contradictory evidence found via search retrieval.
    - VERACITY SCORE: 0-100%
    - VERDICT: Final clinical conclusion.
  `;

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }] },
  });
  return response.text ?? "";
}
