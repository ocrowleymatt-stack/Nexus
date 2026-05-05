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

function inferNodeType(key: string, value: unknown) {
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

function buildClientCsvGraph(csvContent: string): SearchResult {
  let rows: any = csvContent;

  try {
    rows = JSON.parse(csvContent);
  } catch {
    rows = [{ raw: csvContent }];
  }

  if (!Array.isArray(rows)) rows = [rows];

  const cleanRows = rows
    .filter((row: any) => row && typeof row === 'object')
    .slice(0, 500);

  const centralNode = 'CSV Import';
  const nodes = new Map<string, any>();
  const links = new Map<string, any>();

  nodes.set(centralNode, {
    id: centralNode,
    name: centralNode,
    type: 'other',
    description: `Client-side graph generated from ${cleanRows.length} CSV rows. No API or AI provider used.`
  });

  if (cleanRows.length === 0) {
    return {
      centralNode,
      nodes: Array.from(nodes.values()),
      links: [],
      narrative: 'CSV upload completed, but no usable structured rows were found.'
    };
  }

  const columns = Array.from(new Set(cleanRows.flatMap((row: any) => Object.keys(row || {}))));
  const subjectColumn = columns.find((column) => /name|person|subject|entity|contact|title/i.test(String(column))) || columns[0] || 'row';

  for (const [index, row] of cleanRows.entries()) {
    const subjectText = String(row[subjectColumn] ?? `Row ${index + 1}`).trim() || `Row ${index + 1}`;
    const subjectId = subjectText;

    if (!nodes.has(subjectId)) {
      nodes.set(subjectId, {
        id: subjectId,
        name: subjectText,
        type: inferNodeType(String(subjectColumn), subjectText),
        description: `CSV subject from column "${String(subjectColumn)}".`
      });
    }

    links.set(`${centralNode}->${subjectId}->row`, {
      source: centralNode,
      target: subjectId,
      relationship: 'contains CSV row'
    });

    for (const [key, value] of Object.entries(row)) {
      const text = String(value ?? '').trim();
      if (!text || key === subjectColumn || text.length > 160) continue;

      const valueId = `${key}: ${text}`;
      if (!nodes.has(valueId)) {
        nodes.set(valueId, {
          id: valueId,
          name: text,
          type: inferNodeType(key, text),
          description: `CSV value from column "${key}".`
        });
      }

      links.set(`${subjectId}->${valueId}->${key}`, {
        source: subjectId,
        target: valueId,
        relationship: key
      });

      if (nodes.size >= 250) break;
    }

    if (nodes.size >= 250) break;
  }

  return {
    centralNode,
    nodes: Array.from(nodes.values()).map((node) => ({
      ...node,
      val: node.id === centralNode ? 15 : 5
    })),
    links: Array.from(links.values()),
    narrative: `CSV ingestion succeeded locally. Nexus generated a deterministic graph from ${cleanRows.length} rows and inferred "${String(subjectColumn)}" as the central row label. External AI extraction was bypassed to avoid provider-side pattern errors.`
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
  return buildClientCsvGraph(csvContent);
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
