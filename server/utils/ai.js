import { GoogleGenAI } from "@google/genai";
import { VertexAI } from "@google-cloud/vertexai";
import dotenv from 'dotenv';
dotenv.config();

let ai = null;
let vertexAI = null;

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

try {
  vertexAI = new VertexAI({ 
    project: process.env.GOOGLE_CLOUD_PROJECT || '', 
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1' 
  });
} catch (e) {
  console.warn("Vertex AI / ADC initialization failed.");
}

const SEARCH_MODEL = "gemini-2.5-flash";
const VERTEX_MODEL = "gemini-1.5-flash-002";

async function callVeniceAI(prompt) {
  const apiKey = process.env.Venice || process.env.VENICE_API_KEY;
  if (!apiKey) throw new Error("Venice API Key not found");

  const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'default',
      messages: [
        { role: 'system', content: 'You are a deep research analysis intelligence engine. Respond directly with the requested JSON format. Output only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Venice API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Venice returned an empty response");

  return parseAIJson(content);
}

function parseAIJson(text) {
  if (typeof text !== 'string') {
    throw new Error("Intelligence engine returned a non-text response.");
  }

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');

    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      const candidate = cleaned.slice(objectStart, objectEnd + 1);
      try {
        return JSON.parse(candidate);
      } catch (secondError) {
        console.error("Failed to parse extracted AI JSON:", candidate);
      }
    }

    console.error("Failed to parse AI JSON:", cleaned);
    throw new Error("Intelligence engine returned malformed JSON. Try a shorter or more specific search query.");
  }
}

function assertGraphResult(result, fallbackCentralNode) {
  if (!result || typeof result !== 'object') {
    throw new Error("Intelligence engine returned an empty result.");
  }

  const nodes = Array.isArray(result.nodes) ? result.nodes : [];
  const links = Array.isArray(result.links) ? result.links : [];

  if (nodes.length === 0) {
    nodes.push({
      id: fallbackCentralNode,
      name: fallbackCentralNode,
      type: 'other',
      description: 'Central search entity. No additional structured entities were returned by the intelligence engine.'
    });
  }

  return {
    ...result,
    centralNode: result.centralNode || fallbackCentralNode,
    nodes,
    links,
    narrative: result.narrative || ''
  };
}

async function callGeminiApi(prompt) {
  if (!ai) throw new Error("Gemini API Key not found");

  const result = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  const text = result?.text;
  if (!text) throw new Error("Gemini returned an empty response");

  return parseAIJson(text);
}

function toSafeId(value, fallback = 'unknown') {
  const raw = String(value ?? '').trim();
  return raw || fallback;
}

function inferNodeType(key, value) {
  const field = String(key || '').toLowerCase();
  const text = String(value || '').toLowerCase();

  if (field.includes('email') || text.includes('@')) return 'platform';
  if (field.includes('phone') || field.includes('mobile') || field.includes('tel')) return 'platform';
  if (field.includes('address') || field.includes('city') || field.includes('town') || field.includes('postcode') || field.includes('location')) return 'location';
  if (field.includes('company') || field.includes('organisation') || field.includes('organization') || field.includes('employer')) return 'organization';
  if (field.includes('date') || field.includes('time')) return 'event';
  if (field.includes('name') || field.includes('person') || field.includes('contact')) return 'person';
  return 'other';
}

function buildDeterministicCsvGraph(csvContent) {
  let rows = csvContent;

  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [{ raw: rows }];
    }
  }

  if (!Array.isArray(rows)) {
    rows = [rows];
  }

  const cleanRows = rows
    .filter((row) => row && typeof row === 'object')
    .slice(0, 500);

  if (cleanRows.length === 0) {
    return {
      centralNode: 'CSV Import',
      nodes: [{ id: 'CSV Import', name: 'CSV Import', type: 'other', description: 'CSV upload contained no usable structured rows.' }],
      links: [],
      narrative: 'CSV upload completed, but no usable structured rows were found.'
    };
  }

  const columns = Array.from(new Set(cleanRows.flatMap((row) => Object.keys(row || {}))));
  const likelyCentralColumn = columns.find((column) => /name|person|subject|entity|contact|title/i.test(column)) || columns[0] || 'CSV Row';
  const centralNode = 'CSV Import';

  const nodeMap = new Map();
  const linkMap = new Map();

  nodeMap.set(centralNode, {
    id: centralNode,
    name: centralNode,
    type: 'other',
    description: `Deterministic graph generated from ${cleanRows.length} CSV rows and ${columns.length} columns without using an external AI provider.`
  });

  for (const [index, row] of cleanRows.entries()) {
    const rowRecord = row || {};
    const subjectValue = toSafeId(rowRecord[likelyCentralColumn], `Row ${index + 1}`);
    const subjectId = subjectValue;

    if (!nodeMap.has(subjectId)) {
      nodeMap.set(subjectId, {
        id: subjectId,
        name: subjectValue,
        type: inferNodeType(likelyCentralColumn, subjectValue),
        description: `CSV subject from column "${likelyCentralColumn}".`
      });
    }

    const centralLinkKey = `${centralNode}->${subjectId}->contains`;
    linkMap.set(centralLinkKey, { source: centralNode, target: subjectId, relationship: 'contains CSV row' });

    for (const [key, value] of Object.entries(rowRecord)) {
      const text = String(value ?? '').trim();
      if (!text || key === likelyCentralColumn) continue;
      if (text.length > 160) continue;

      const fieldNodeId = `${key}: ${text}`;
      if (!nodeMap.has(fieldNodeId)) {
        nodeMap.set(fieldNodeId, {
          id: fieldNodeId,
          name: text,
          type: inferNodeType(key, text),
          description: `Value from CSV column "${key}".`
        });
      }

      const linkKey = `${subjectId}->${fieldNodeId}->${key}`;
      linkMap.set(linkKey, { source: subjectId, target: fieldNodeId, relationship: key });

      if (nodeMap.size >= 250) break;
    }

    if (nodeMap.size >= 250) break;
  }

  return {
    centralNode,
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
    narrative: `CSV ingestion succeeded. Nexus generated a deterministic network from ${cleanRows.length} rows. Central column inferred as "${likelyCentralColumn}". AI extraction is bypassed for CSV uploads to avoid provider-side pattern/JSON failures.`
  };
}

export async function deepSearchEntity(entityName) {
  const safeEntityName = String(entityName || '').trim();
  if (!safeEntityName) throw new Error("Search query is empty");

  const prompt = `
    Conduct a deep research investigation into the entity: ${JSON.stringify(safeEntityName)}.
    
    1. Identify all key "nodes" (entities, organizations, aliases) connected to this entity.
    2. Characterize each node with a descriptive profile.
    3. Define the specific "links" (relationships) between these nodes.
    4. Write a cohesive investigative narrative that explains the "story" behind these connections.
    
    Return only a valid JSON object with this exact shape:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try {
      return assertGraphResult(await callVeniceAI(prompt), safeEntityName);
    } catch (e) {
      console.warn("Venice failed:", e?.message || e);
    }
  }

  if (vertexAI) {
    try {
      const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const content = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return assertGraphResult(parseAIJson(content), safeEntityName);
    } catch (e) {
      console.warn("Vertex AI failed:", e?.message || e);
    }
  }

  if (ai) {
    return assertGraphResult(await callGeminiApi(prompt), safeEntityName);
  }

  throw new Error("No AI available for deep search");
}

export async function extractIntelligenceFromCsv(csvContent) {
  return buildDeterministicCsvGraph(csvContent);
}

export async function huntZipIntelligence(zipName, fileTree, fileSamples) {
  const samplesText = Object.entries(fileSamples || {})
    .map(([path, content]) => `FILE: ${path}\nCONTENT: ${String(content).substring(0, 1000)}`)
    .join('\n\n---\n\n');

  const prompt = `
    You are a digital forensic investigator. I have a ZIP archive named ${JSON.stringify(zipName)}.
    Here is the file structure:
    ${(fileTree || []).join('\n')}
    
    And here are samples from key files:
    ${samplesText}
    
    Your task:
    1. Identify the primary subject/person this archive belongs to.
    2. Map out their immediate connections based on metadata, filenames, and file content.
    3. Construct an "Investigative Profile" narrative that summarizes their digital footprint and key affiliations.
    4. Extract nodes and links reflecting these relationships.
    
    Return only a valid JSON object with this exact shape:
    {
      "centralNode": "string",
      "nodes": [ { "id": "string", "name": "string", "type": "person|organization|event|platform|location|other", "description": "string" } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `;

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return assertGraphResult(await callVeniceAI(prompt), zipName || 'ZIP Import'); } catch (e) { console.warn("Venice failed:", e?.message || e); }
  }

  if (vertexAI) {
    try {
      const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const content = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return assertGraphResult(parseAIJson(content), zipName || 'ZIP Import');
    } catch (e) { console.warn("Vertex AI failed:", e?.message || e); }
  }

  if (ai) {
    return assertGraphResult(await callGeminiApi(prompt), zipName || 'ZIP Import');
  }
  throw new Error("No AI available for ZIP analysis");
}
