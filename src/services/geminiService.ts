/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

const SEARCH_MODEL = "gemini-3.1-pro-preview";

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const prompt = `
    Conduct a deep research investigation into the entity: "${entityName}".
    
    1. Seek out hidden connections, professional ties, public affiliations, and significant events associated with this entity.
    2. Extract a list of key "nodes" (entities connected to the central node).
    3. Define the specific "links" (relationships) between these nodes.
    4. Write a cohesive investigative narrative that explains the "story" behind these connections.
    
    Structure your response as a JSON object with the following schema:
    - nodes: Array of { id: string, name: string, type: 'person'|'organization'|'event'|'platform'|'location'|'other', description: string }
    - links: Array of { source: string, target: string, relationship: string }
    - narrative: string (A markdown-formatted investigative summary)
    
    Ensure the central node ("${entityName}") is included in the nodes list.
    Be thorough and prefer recent/real-world data found via search.
  `;

  try {
    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['person', 'organization', 'event', 'platform', 'location', 'other'] },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "type"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  relationship: { type: Type.STRING }
                },
                required: ["source", "target", "relationship"]
              }
            },
            narrative: { type: Type.STRING }
          },
          required: ["nodes", "links", "narrative"]
        },
        tools: [{ googleSearch: {} }],
        toolConfig: { includeServerSideToolInvocations: true }
      },
    });

    const resultText = response.text;
    const parsed = JSON.parse(resultText);
    
    // Add weights/val for visualization
    const nodes = parsed.nodes.map((n: any) => ({
      ...n,
      val: n.id === entityName || n.name === entityName ? 15 : 5
    }));

    return {
      nodes,
      links: parsed.links,
      narrative: parsed.narrative,
      centralNode: entityName
    };
  } catch (error) {
    console.error("Deep search error:", error);
    throw error;
  }
}

export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const prompt = `
    You are a data intelligence analyst. I have provided a raw CSV data dump.
    Your task is to analyze this data and extract a meaningful network map and a narrative summary.
    
    RAW CSV DATA:
    ${csvContent.substring(0, 10000)} // Truncated to avoid context limits if huge
    
    1. Identify the most significant central node or theme in this data.
    2. Extract a list of key "nodes" (entities, organizations, people, locations) mentioned.
    3. Define "links" (relationships, transactions, or interactions) between these nodes.
    4. Write a markdown-formatted intelligence report that synthesizes the "narrative" of what's happening based on the data.
    
    Structure your response as a JSON object with the following schema:
    - centralNode: string (The name of the primary subject identified)
    - nodes: Array of { id: string, name: string, type: 'person'|'organization'|'event'|'platform'|'location'|'other', description: string }
    - links: Array of { source: string, target: string, relationship: string }
    - narrative: string (A markdown-formatted investigative summary)
  `;

  try {
    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            centralNode: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['person', 'organization', 'event', 'platform', 'location', 'other'] },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "type"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  relationship: { type: Type.STRING }
                },
                required: ["source", "target", "relationship"]
              }
            },
            narrative: { type: Type.STRING }
          },
          required: ["centralNode", "nodes", "links", "narrative"]
        }
      },
    });

    const parsed = JSON.parse(response.text);
    
    const nodes = parsed.nodes.map((n: any) => ({
      ...n,
      val: n.name === parsed.centralNode ? 15 : 5
    }));

    return {
      nodes,
      links: parsed.links,
      narrative: parsed.narrative,
      centralNode: parsed.centralNode
    };
  } catch (error) {
    console.error("CSV extraction error:", error);
    throw error;
  }
}

export async function huntZipIntelligence(
  zipName: string, 
  fileTree: string[], 
  fileSamples: { [path: string]: string }
): Promise<SearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const samplesText = Object.entries(fileSamples)
    .map(([path, content]) => `FILE: ${path}\nCONTENT: ${content.substring(0, 1000)}`)
    .join('\n\n---\n\n');

  const prompt = `
    You are a Forensic Intelligence Analyst specializing in metadata hunting.
    I have a ZIP export (likely a Google Takeout or Meta/Facebook dump) named "${zipName}".
    
    FILE TREE (Sample):
    ${fileTree.slice(0, 50).join('\n')}
    
    HIGH-VALUE FILE SAMPLES:
    ${samplesText}
    
    YOUR TASK:
    1. Identify the "Principal Subject" (the person or entity this dump belongs to).
    2. Map out the "Social and Digital Graph" — connections to people, groups, apps, and locations.
    3. Construct an "Investigative Profile" narrative that summarizes their digital footprint and key affiliations.
    4. Extract nodes and links reflecting these relationships.
    
    Structure your response as a JSON object with:
    - centralNode: string (Subject Name)
    - nodes: Array of { id, name, type, description }
    - links: Array of { source, target, relationship }
    - narrative: string (Markdown Report)
  `;

  try {
    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            centralNode: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['person', 'organization', 'event', 'platform', 'location', 'other'] },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "type"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  relationship: { type: Type.STRING }
                },
                required: ["source", "target", "relationship"]
              }
            },
            narrative: { type: Type.STRING }
          },
          required: ["centralNode", "nodes", "links", "narrative"]
        }
      },
    });

    const parsed = JSON.parse(response.text);
    return {
      nodes: parsed.nodes.map((n: any) => ({ ...n, val: n.name === parsed.centralNode ? 15 : 5 })),
      links: parsed.links,
      narrative: parsed.narrative,
      centralNode: parsed.centralNode
    };
  } catch (error) {
    console.error("ZIP hunting error:", error);
    throw error;
  }
}
