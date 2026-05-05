export type IngestClaim = {
  claim_id: string
  text: string
  type: 'fact' | 'inference' | 'hypothesis' | string
  source_refs: string[]
}

export type IngestSource = {
  source_id: string
  title: string
  createdAt?: string
}

export type IngestEntity = {
  entity_id: string
  name: string
  type: string
  confidence?: string
  source_refs: string[]
}

function safeIncludes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function canonicalEntityId(entity: IngestEntity) {
  const normalised = entity.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();

  return `ENT_${entity.type.toLowerCase().replace(/[^a-z0-9]/g, '')}_${normalised}`;
}

function normalizeId(id: string) {
  if (!id) return `ID_${Math.random().toString(36).substring(7)}`;
  return id
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^[0-9]/, 'N$&'); // Ensure it doesn't start with a number
}

export function buildGraphFromIngest(source: IngestSource, claims: IngestClaim[], entities: IngestEntity[] = []) {
  const normalizedSourceId = normalizeId(source.source_id);

  const canonicalEntities = entities.map(entity => ({
    ...entity,
    entity_id: canonicalEntityId(entity)
  }))

  const sourceNode = {
    id: normalizedSourceId,
    label: source.title || source.source_id,
    type: 'source',
    group: 'source'
  }

  const claimNodes = claims.map(claim => ({
    id: normalizeId(claim.claim_id),
    label: claim.text.slice(0, 90),
    type: claim.type,
    group: claim.type,
    text: claim.text
  }))

  const entityNodes = canonicalEntities.map(entity => ({
    id: normalizeId(entity.entity_id),
    label: entity.name,
    type: entity.type,
    group: entity.type,
    confidence: entity.confidence || 'moderate',
    source_refs: entity.source_refs || []
  }))

  const claimLinks = claims.map(claim => ({
    source: normalizedSourceId,
    target: normalizeId(claim.claim_id),
    relation: 'supports_claim',
    strength: claim.type === 'fact' ? 'strong' : claim.type === 'inference' ? 'moderate' : 'weak'
  }))

  const sourceEntityLinks = canonicalEntities.map(entity => ({
    source: normalizedSourceId,
    target: normalizeId(entity.entity_id),
    relation: 'mentions_entity',
    strength: entity.confidence === 'high' ? 'strong' : entity.confidence === 'low' ? 'weak' : 'moderate'
  }))

  const claimEntityLinks = claims.flatMap(claim =>
    canonicalEntities
      .filter(entity => safeIncludes(claim.text, entity.name))
      .map(entity => ({
        source: normalizeId(claim.claim_id),
        target: normalizeId(entity.entity_id),
        relation: 'claim_mentions_entity',
        strength: claim.type === 'fact' ? 'strong' : 'moderate'
      }))
  )

  return {
    nodes: [sourceNode, ...claimNodes, ...entityNodes],
    links: [...claimLinks, ...sourceEntityLinks, ...claimEntityLinks],
    narrative: claims.map(c => c.text).join('\n\n'),
    centralNode: source.title
  }
}

function levenshtein(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function areSimilar(s1: string, s2: string): boolean {
  if (!s1 || !s2) return false;
  const n1 = s1.toLowerCase().trim();
  const n2 = s2.toLowerCase().trim();
  if (n1 === n2) return true;
  
  // High similarity threshold for person names (e.g. "John Doe" vs "Jon Doe")
  const distance = levenshtein(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = (maxLength - distance) / maxLength;
  
  // If short names, require closer match
  if (maxLength < 5) return similarity > 0.8;
  return similarity > 0.85; 
}

export function mergeGraphs(existing: any, incoming: any) {
  const nodeMap = new Map<string, any>()
  const linkKey = (link: any) => `${link.source}->${link.target}:${link.relation || link.relationship || 'link'}`
  const linkMap = new Map<string, any>()

  // Load existing nodes
  for (const node of existing?.nodes || []) {
    nodeMap.set(node.id, { ...node })
  }

  // Merge incoming nodes
  for (const node of incoming?.nodes || []) {
    const rawId = node.id || node.name || `NODE_${Math.random()}`;
    const safeId = normalizeId(rawId);
    
    // First check if this EXACT ID exists
    const existingNode = nodeMap.get(safeId)
    
    const newNode = { ...node, id: safeId };

    if (existingNode) {
      nodeMap.set(safeId, {
        ...existingNode,
        ...newNode,
        description: existingNode.description && newNode.description && existingNode.description !== newNode.description
          ? `${existingNode.description}\n\n[UPDATE]: ${newNode.description}`
          : newNode.description || existingNode.description,
        source_refs: [...new Set([...(existingNode.source_refs || []), ...(newNode.source_refs || [])])]
      })
    } else {
      // Check for FUZZY matching by name among existing nodes in nodeMap
      let foundFuzzy = false;
      const newNodeName = newNode.label || newNode.name;

      if (newNodeName) {
        for (const [existingId, eNode] of nodeMap.entries()) {
          const eName = eNode.label || eNode.name;
          if (areSimilar(newNodeName, eName)) {
             // Found a fuzzy match! Merge into eNode and Redirect newNodeId to existingId later
             nodeMap.set(existingId, {
               ...eNode,
               description: eNode.description && newNode.description && eNode.description !== newNode.description
                ? `${eNode.description}\n\n[FUZZY ASSET]: ${newNode.description}`
                : newNode.description || eNode.description,
               source_refs: [...new Set([...(eNode.source_refs || []), ...(newNode.source_refs || [])])]
             });
             foundFuzzy = true;
             // We'll handle ID mapping for links at the end
             break;
          }
        }
      }

      if (!foundFuzzy) {
        nodeMap.set(safeId, newNode)
      }
    }
  }

  // Final Pass: Deduplicate nodes by NAME (Case-Insensitive) AND Similarity
  const finalNodes: any[] = []
  const idRedirection = new Map<string, string>()
  const processedNames: string[] = []

  for (const [id, node] of nodeMap.entries()) {
    const nodeName = node.label || node.name || id;
    let canonicalId: string | null = null;

    // Check if this node's name is similar to something we already accepted for finalNodes
    for (const finalNode of finalNodes) {
      const finalName = finalNode.label || finalNode.name;
      if (areSimilar(nodeName, finalName)) {
        canonicalId = finalNode.id;
        break;
      }
    }

    if (canonicalId) {
      idRedirection.set(id, canonicalId)
      const canonicalNode = finalNodes.find(n => n.id === canonicalId);
      if (canonicalNode && canonicalNode.id !== id) {
        canonicalNode.description = (canonicalNode.description || '') + (node.description && !canonicalNode.description.includes(node.description) ? `\n[MERGED]: ${node.description}` : '')
        canonicalNode.source_refs = [...new Set([...(canonicalNode.source_refs || []), ...(node.source_refs || [])])]
      }
    } else {
      finalNodes.push(node)
    }
  }

  // Merge Links and apply ID redirection for merged nodes
  const allIncomingLinks = incoming?.links || [];
  const existingLinks = existing?.links || [];
  const allLinks = [...existingLinks, ...allIncomingLinks];

  const normalizedLinks = allLinks.map((l: any) => ({
    ...l,
    source: normalizeId(l.source?.id || l.source),
    target: normalizeId(l.target?.id || l.target)
  }));

  for (const link of normalizedLinks) {
    const sourceRaw = link.source;
    const targetRaw = link.target;
    
    const sourceId = idRedirection.get(sourceRaw) || sourceRaw;
    const targetId = idRedirection.get(targetRaw) || targetRaw;
    
    if (!sourceId || !targetId || sourceId === targetId) continue;

    const redirectedLink = {
      ...link,
      source: sourceId,
      target: targetId,
      relation: link.relation || link.relationship || 'link'
    }
    linkMap.set(linkKey(redirectedLink), redirectedLink)
  }

  return {
    nodes: finalNodes,
    links: [...linkMap.values()],
    narrative: incoming.narrative || existing.narrative,
    centralNode: incoming.centralNode || existing.centralNode
  }
}
