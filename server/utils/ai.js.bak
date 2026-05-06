import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

let ai;

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const SEARCH_MODEL = "gemini-2.5-flash";

export async function callVeniceAI(prompt) {
  const apiKey = process.env.Venice || process.env.VENICE_API_KEY;
  if (!apiKey) throw new Error("Venice API Key not found");

  const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [
        { role: 'system', content: 'You are a deep research analysis intelligence engine. You MUST respond exactly and only with a valid JSON object. Do not include any pretext or posttext. Escape all internal quotes.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Venice API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return parseAIJson(content);
}

function parseAIJson(text) {
  if (!text) throw new Error("Empty response from AI");
  
  let cleaned = text.trim();
  console.log(`[AI_PARSER] Input length: ${cleaned.length}`);
  
  // Try to extract from markdown blocks
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  } else {
    // Try to find the JSON structure directly if no markdown markers
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
  }

  const tryParse = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn(`[AI_PARSER] JSON.parse failed for segment: ${e.message}`);
      return null;
    }
  };

  // Try pure cleaned first
  let result = tryParse(cleaned);
  if (result) return result;

  // Stage 1: Sanitation - handle common AI formatting quirks safely
  let sanitized = cleaned
    .replace(/,\s*([\]}])/g, '$1') // Trailing commas
    .replace(/\[\d+(?:,\s*\d+)*\]/g, ''); // Remove citations [1] or [1, 2]

  result = tryParse(sanitized);
  if (result) return result;

  // Stage 2: Handle literal newlines in strings
  // Only target characters between double quotes to avoid breaking structure
  let newlineFixed = sanitized.replace(/"([^"]*)"/g, (match, p1) => {
    return '"' + p1.replace(/\n+/g, '\\n').replace(/\r+/g, '\\r') + '"';
  });

  result = tryParse(newlineFixed);
  if (result) return result;

  // Stage 3: Aggressive Quote Escaping for narrative/descriptions
  // We target only values that are followed by characters indicating end of object/array or next key
  let aggressive = newlineFixed.replace(/":\s*"([\s\S]*?)"\s*([,}\]])/g, (match, p1, p2) => {
    // Escape quotes that are NOT preceded by a backslash
    const escapedValue = p1.replace(/(?<!\\)"/g, '\\"');
    return `": "${escapedValue}"${p2}`;
  });

  // Stage 3.5: Handle missing commas between property-value pairs
  // This looks for "value" followed by "newKey": without a comma
  let commaFixed = aggressive.replace(/"\s*\n\s*"/g, '", "');
  
  result = tryParse(commaFixed);
  if (result) return result;

  // Stage 4: Rescue Stage - Regex Extraction
  console.warn("[AI_PARSER] JSON.parse failed all stages. Attempting Regex Rescue...");
  try {
    const nodesMatch = aggressive.match(/"nodes"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    const linksMatch = aggressive.match(/"links"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    const narrativeMatch = aggressive.match(/"narrative"\s*:\s*"([\s\S]*?)"\s*[,}]/);

    if (nodesMatch || linksMatch) {
      const rescueResult = {
        nodes: nodesMatch ? (tryParse(nodesMatch[1]) || []) : [],
        links: linksMatch ? (tryParse(linksMatch[1]) || []) : [],
        narrative: narrativeMatch ? (narrativeMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')) : ""
      };
      if (rescueResult.nodes.length > 0 || rescueResult.links.length > 0) {
        console.log("[AI_PARSER] Regex Rescue successful!");
        return rescueResult;
      }
    }
  } catch (e) {
    console.error("[AI_PARSER] Regex Rescue failed:", e);
  }

  console.error("[AI_PARSER] ALL PARSING ATTEMPTS FAILED.");
  console.error("[AI_PARSER] Problematic block text (first 2000 chars):", cleaned.substring(0, 2000));
  
  throw new Error("Intelligence engine returned malformed data or is under heavy load. Expected stream pattern not detected.");
}

export async function deepSearchEntity(entityName) {
  if (!entityName) throw new Error("Entity name required");

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

  // Trace
  console.log(`Starting deep search for: ${entityName}`);

  // Try Venice first if configured
  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try {
      return await callVeniceAI(prompt);
    } catch (e) { console.warn("Venice failed:", e.message); }
  }

  // Fallback to Gemini API
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      // The GenAI SDK returned result has a .text property
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API deep search failed:", e);
      throw e;
    }
  }

  throw new Error("No AI available for deep search");
}

export async function extractIntelligenceFromCsv(csvContent) {
  if (!csvContent) throw new Error("CSV content required");

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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API CSV extraction failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for CSV extraction");
}

export async function huntZipIntelligence(zipName, fileTree, fileSamples) {
  const samplesText = Object.entries(fileSamples)
    .map(([path, content]) => `FILE: ${path}\nCONTENT: ${content.substring(0, 1000)}`)
    .join('\n\n---\n\n');

  const prompt = `
    You are a digital forensic investigator. I have a ZIP archive named "${zipName}".
    Here is the file structure:
    ${fileTree.join('\n')}
    
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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API ZIP analysis failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for ZIP analysis");
}

export async function forensicSearchNode(entityName) {
  const prompt = `
    Perform a forensic legal and public records search for the entity: "${entityName}".
    
    FOCUS AREAS:
    1. Civil and criminal court filings (PACER, local courts).
    2. Regulatory enforcement actions (SEC, FTC, FCA, etc.).
    3. Law enforcement mentions or digital footprint in police-adjacent registers.
    4. Corporate registration history and high-level litigation involvement.
    
    Provide a concise, high-density "Forensic Spotlight" summary. If no legal records are found, state "No visible public legal friction detected."
  `;

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      return response.text;
    } catch (e) {
      console.error("Gemini API forensic search failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for forensic search");
}

export async function testHypothesis(hypothesis, contextNodes) {
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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      return response.text;
    } catch (e) {
      console.error("Gemini API hypothesis test failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for hypothesis test");
}

export async function expandGraph(existingData) {
  const nodeNames = existingData.nodes.map(n => n.name || n.id).join(", ");
  
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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API graph expansion failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for graph expansion");
}

export async function extractIntelligenceFromUrl(url) {
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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API URL extraction failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for URL extraction");
}

export async function extractIntelligenceFromText(text) {
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

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: SEARCH_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      return parseAIJson(response.text);
    } catch (e) {
      console.error("Gemini API text extraction failed:", e);
      throw e;
    }
  }
  throw new Error("No AI available for text extraction");
}
