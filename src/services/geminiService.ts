import { SearchResult } from "../types";

async function parseJsonResponse(response: Response, fallbackLabel: string) {
  const text = await response.text();

  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Server returned non-JSON response from ${fallbackLabel}: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `${fallbackLabel} failed (${response.status})`);
  }

  if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    throw new Error(`Malformed response from ${fallbackLabel}`);
  }

  return data;
}

function normaliseGraph(data: any, fallbackCentralNode: string): SearchResult {
  const centralNode = data.centralNode || fallbackCentralNode;
  const nodes = data.nodes.map((n: any) => ({
    ...n,
    val: n.id === centralNode || n.name === centralNode ? 15 : 5
  }));

  return {
    nodes,
    links: data.links,
    narrative: data.narrative || '',
    centralNode
  };
}

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  if (!entityName || !entityName.trim()) {
    throw new Error("Search query is empty");
  }

  const response = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: entityName.trim() })
  });

  const data = await parseJsonResponse(response, '/api/ai/search');
  return normaliseGraph(data, entityName.trim());
}

export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  let rows: unknown = csvContent;

  try {
    rows = JSON.parse(csvContent);
  } catch {
    rows = csvContent;
  }

  const response = await fetch('/api/ai/extract-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent: rows })
  });

  const data = await parseJsonResponse(response, '/api/ai/extract-csv');
  return normaliseGraph(data, data.centralNode || 'CSV Import');
}

export async function huntZipIntelligence(
  zipName: string, 
  fileTree: string[], 
  fileSamples: { [path: string]: string }
): Promise<SearchResult> {
  const response = await fetch('/api/ai/hunt-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zipName, fileTree, fileSamples })
  });

  const data = await parseJsonResponse(response, '/api/ai/hunt-zip');
  return normaliseGraph(data, data.centralNode || zipName || 'ZIP Import');
}
