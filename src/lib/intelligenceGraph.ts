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
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9+@. -]/g, '')
    .trim()
    .replace(/\s/g, '_')

  return `ENT-${entity.type}-${normalised}`
}

export function buildGraphFromIngest(source: IngestSource, claims: IngestClaim[], entities: IngestEntity[] = []) {
  const canonicalEntities = entities.map(entity => ({
    ...entity,
    entity_id: canonicalEntityId(entity)
  }))

  const sourceNode = {
    id: source.source_id,
    label: source.title || source.source_id,
    type: 'source',
    group: 'source'
  }

  const claimNodes = claims.map(claim => ({
    id: claim.claim_id,
    label: claim.text.slice(0, 90),
    type: claim.type,
    group: claim.type,
    text: claim.text
  }))

  const entityNodes = canonicalEntities.map(entity => ({
    id: entity.entity_id,
    label: entity.name,
    type: entity.type,
    group: entity.type,
    confidence: entity.confidence || 'moderate',
    source_refs: entity.source_refs || []
  }))

  const claimLinks = claims.map(claim => ({
    source: source.source_id,
    target: claim.claim_id,
    relation: 'supports_claim',
    strength: claim.type === 'fact' ? 'strong' : claim.type === 'inference' ? 'moderate' : 'weak'
  }))

  const sourceEntityLinks = canonicalEntities.map(entity => ({
    source: source.source_id,
    target: entity.entity_id,
    relation: 'mentions_entity',
    strength: entity.confidence === 'high' ? 'strong' : entity.confidence === 'low' ? 'weak' : 'moderate'
  }))

  const claimEntityLinks = claims.flatMap(claim =>
    canonicalEntities
      .filter(entity => safeIncludes(claim.text, entity.name))
      .map(entity => ({
        source: claim.claim_id,
        target: entity.entity_id,
        relation: 'claim_mentions_entity',
        strength: claim.type === 'fact' ? 'strong' : 'moderate'
      }))
  )

  return {
    nodes: [sourceNode, ...claimNodes, ...entityNodes],
    links: [...claimLinks, ...sourceEntityLinks, ...claimEntityLinks]
  }
}

export function mergeGraphs(existing: any, incoming: any) {
  const nodeMap = new Map<string, any>()
  const linkKey = (link: any) => `${link.source}->${link.target}:${link.relation || 'link' || link.relationship}`
  const linkMap = new Map<string, any>()

  // Load existing nodes
  for (const node of existing?.nodes || []) {
    nodeMap.set(node.id, { ...node })
  }

  // Merge incoming nodes
  for (const node of incoming?.nodes || []) {
    const existingNode = nodeMap.get(node.id)
    
    if (existingNode) {
      nodeMap.set(node.id, {
        ...existingNode,
        ...node,
        // Build a richer profile by merging descriptions
        description: existingNode.description && node.description && existingNode.description !== node.description
          ? `${existingNode.description}\n\n[UPDATE]: ${node.description}`
          : node.description || existingNode.description,
        source_refs: [...new Set([...(existingNode.source_refs || []), ...(node.source_refs || [])])]
      })
    } else {
      nodeMap.set(node.id, node)
    }
  }

  // Deduplicate nodes by NAME (Case-Insensitive)
  // This solves "Two contacts actually being one"
  const nameMap = new Map<string, string>() // Name (Lower) -> Canonical ID
  const finalNodes: any[] = []
  const idRedirection = new Map<string, string>()

  for (const [id, node] of nodeMap.entries()) {
    const lowerName = node.label?.toLowerCase() || node.name?.toLowerCase() || id.toLowerCase()
    if (nameMap.has(lowerName)) {
      const canonicalId = nameMap.get(lowerName)!
      idRedirection.set(id, canonicalId)
      
      const canonicalNode = nodeMap.get(canonicalId)
      if (canonicalNode) {
        canonicalNode.description = (canonicalNode.description || '') + (node.description ? `\n${node.description}` : '')
        canonicalNode.source_refs = [...new Set([...(canonicalNode.source_refs || []), ...(node.source_refs || [])])]
      }
    } else {
      nameMap.set(lowerName, id)
      finalNodes.push(node)
    }
  }

  // Merge Links and apply ID redirection for merged nodes
  for (const link of [...(existing?.links || []), ...(incoming?.links || [])]) {
    const sourceId = idRedirection.get(link.source) || link.source
    const targetId = idRedirection.get(link.target) || link.target
    
    // Avoid self-links created by merging
    if (sourceId === targetId) continue

    const redirectedLink = {
      ...link,
      source: sourceId,
      target: targetId
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
