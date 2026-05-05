import { SearchResult } from "../types";

export async function deepSearchEntity(entityName: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/deep-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Deep search failed");
  }

  return response.json();
}

export async function extractIntelligenceFromCsv(csvContent: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/extract-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "CSV extraction failed");
  }

  return response.json();
}

export async function forensicSearchNode(entityName: string): Promise<string> {
  const response = await fetch('/api/ai/forensic-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Forensic search failed");
  }

  const data = await response.json();
  return data.text;
}

export async function testHypothesis(hypothesis: string, contextNodes: string[]): Promise<string> {
  const response = await fetch('/api/ai/test-hypothesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hypothesis, contextNodes })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Hypothesis testing failed");
  }

  const data = await response.json();
  return data.text;
}

export async function expandGraph(existingData: SearchResult): Promise<SearchResult> {
  const response = await fetch('/api/ai/expand-graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingData })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Graph expansion failed");
  }

  return response.json();
}

export async function extractIntelligenceFromText(text: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Text extraction failed");
  }

  return response.json();
}

export async function extractIntelligenceFromUrl(url: string): Promise<SearchResult> {
  const response = await fetch('/api/ai/extract-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "URL extraction failed");
  }

  return response.json();
}

export async function huntZipIntelligence(
  zipName: string, 
  fileTree: string[], 
  fileSamples: { [path: string]: string }
): Promise<SearchResult> {
  // ZIP analysis stays client-side because of complexity of passing everything 
  // but let's try to pass it to the server if possible or implement it better.
  // Actually, let's keep it on the server too for consistency.
  
  const response = await fetch('/api/ai/hunt-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zipName, fileTree, fileSamples })
  });
  
  if (response.ok) {
    return response.json();
  }
  
  const err = await response.json();
  throw new Error(err.error || "ZIP analysis failed");
}

export async function veniceSensemaking(existingData: SearchResult): Promise<SearchResult> {
  const response = await fetch('/api/ai/venice-clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingData })
  });

  if (response.ok) {
    return response.json();
  }

  const err = await response.json();
  throw new Error(err.error || "Venice sensemaking failed");
}
