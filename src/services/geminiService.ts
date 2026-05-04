import { SearchResult } from "../types";

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: entityName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Search failed');
  }

  const data = await response.json();
  
  // Add values for visual weighting
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

// These would need server-side counterparts too if used, 
// for now let's just stub them or implement them similarly if needed.
export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/extract-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'CSV extraction failed');
  }

  const data = await response.json();
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

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'ZIP analysis failed');
  }

  const data = await response.json();
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
