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

export function buildGraphFromIngest(source: IngestSource, claims: IngestClaim[]) {
  const nodes = [
    {
      id: source.source_id,
      label: source.title || source.source_id,
      type: 'source',
      group: 'source'
    },
    ...claims.map(claim => ({
      id: claim.claim_id,
      label: claim.text.slice(0, 90),
      type: claim.type,
      group: claim.type
    }))
  ]

  const links = claims.map(claim => ({
    source: source.source_id,
    target: claim.claim_id,
    relation: 'supports',
    strength: claim.type === 'fact' ? 'strong' : claim.type === 'inference' ? 'moderate' : 'weak'
  }))

  return { nodes, links }
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
