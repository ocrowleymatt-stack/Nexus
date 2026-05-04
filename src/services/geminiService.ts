import { SearchResult } from "../types";

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  if (!entityName || !entityName.trim()) {
    throw new Error("Search query is empty");
  }

  const response = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: entityName.trim() })
  });

  const text = await response.text();

  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Server returned non-JSON response: ${text.slice(0,200)}`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Search failed (${response.status})`);
  }

  if (!data.nodes || !data.links) {
    throw new Error("Malformed response from /api/ai/search");
  }

  const nodes = data.nodes.map((n: any) => ({
    ...n,
    val: n.id === entityName || n.name === entityName ? 15 : 5
  }));

  return {
    nodes,
    links: data.links,
    narrative: data.narrative,
    centralNode: entityName
  };
}

export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/extract-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent })
  });

  const text = await response.text();
  let data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.error || 'CSV extraction failed');
  }

  const nodes = data.nodes.map((n: any) => ({
    ...n,
    val: n.id === data.centralNode || n.name === data.centralNode ? 15 : 5
  }));

  return {
    nodes,
    links: data.links,
    narrative: data.narrative,
    centralNode: data.centralNode
  };
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

  const text = await response.text();
  let data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.error || 'ZIP analysis failed');
  }

  const nodes = data.nodes.map((n: any) => ({
    ...n,
    val: n.id === data.centralNode || n.name === data.centralNode ? 15 : 5
  }));

  return {
    nodes,
    links: data.links,
    narrative: data.narrative,
    centralNode: data.centralNode
  };
}
