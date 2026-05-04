import { GoogleGenAI } from "@google/genai";
import { VertexAI } from "@google-cloud/vertexai";
import dotenv from 'dotenv';
dotenv.config();

let ai;
let vertexAI = null;

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
}

try {
  vertexAI = new VertexAI({ 
    project: process.env.GOOGLE_CLOUD_PROJECT || '', 
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1' 
  });
} catch (e) {
  console.warn("Vertex AI / ADC initialization failed.");
}

const SEARCH_MODEL = "gemini-3-flash-preview";
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
  const content = data.choices[0].message.content;
  return parseAIJson(content);
}

function parseAIJson(text) {
  try {
    // Try to find JSON block - more flexible regex
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonString.trim());
  } catch (e) {
    console.error("Failed to parse AI JSON:", text);
    throw new Error("Intelligence engine returned malformed data.");
  }
}

export async function deepSearchEntity(entityName) {
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

  // Try Venice first if configured
  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try {
      return await callVeniceAI(prompt);
    } catch (e) { console.warn("Venice failed"); }
  }

  // Try ADC / Vertex AI
  if (vertexAI) {
    try {
      const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const content = result.response.candidates?.[0].content.parts[0].text;
      if (content) return JSON.parse(content);
    } catch (e) { console.warn("Vertex AI failed"); }
  }

  // Fallback to Gemini API
  if (ai) {
    const model = ai.getGenerativeModel({ model: SEARCH_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseAIJson(text);
  }

  throw new Error("No AI available for deep search");
}

export async function extractIntelligenceFromCsv(csvContent) {
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
    ${csvContent}
  `;

  if (process.env.Venice || process.env.VENICE_API_KEY) {
    try { return await callVeniceAI(prompt); } catch (e) {}
  }

  if (vertexAI) {
    try {
      const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const content = result.response.candidates?.[0].content.parts[0].text;
      if (content) return parseAIJson(content);
    } catch (e) {}
  }

  if (ai) {
    const model = ai.getGenerativeModel({ model: SEARCH_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseAIJson(text);
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

  if (vertexAI) {
    try {
      const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const content = result.response.candidates?.[0].content.parts[0].text;
      if (content) return parseAIJson(content);
    } catch (e) {}
  }

  if (ai) {
    const model = ai.getGenerativeModel({ model: SEARCH_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseAIJson(text);
  }
  throw new Error("No AI available for ZIP analysis");
}
