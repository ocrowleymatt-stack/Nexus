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

export function buildGraphFromIngest(source: IngestSource, claims: IngestClaim[], entities: IngestEntity[] = []) {
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

  const entityNodes = entities.map(entity => ({
    id: entity.entity_id,
    label: entity.name,
    type: entity.type,
    group: entity.type,
    confidence: entity.confidence || 'moderate'
  }))

  const claimLinks = claims.map(claim => ({
    source: source.source_id,
    target: claim.claim_id,
    relation: 'supports_claim',
    strength: claim.type === 'fact' ? 'strong' : claim.type === 'inference' ? 'moderate' : 'weak'
  }))

  const sourceEntityLinks = entities.map(entity => ({
    source: source.source_id,
    target: entity.entity_id,
    relation: 'mentions_entity',
    strength: entity.confidence === 'high' ? 'strong' : entity.confidence === 'low' ? 'weak' : 'moderate'
  }))

  const claimEntityLinks = claims.flatMap(claim =>
    entities
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
  const linkKey = (link: any) => `${link.source}->${link.target}:${link.relation || 'link'}`
  const linkMap = new Map<string, any>()

  for (const node of existing?.nodes || []) nodeMap.set(node.id, node)
  for (const node of incoming?.nodes || []) nodeMap.set(node.id, { ...nodeMap.get(node.id), ...node })

  for (const link of existing?.links || []) linkMap.set(linkKey(link), link)
  for (const link of incoming?.links || []) linkMap.set(linkKey(link), link)

  return {
    nodes: [...nodeMap.values()],
    links: [...linkMap.values()]
  }
}
