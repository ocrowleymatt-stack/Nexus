export type GraphLink = {
  source: string
  target: string
  relation?: string
  strength?: 'weak' | 'moderate' | 'strong'
  evidence_count?: number
  source_count?: number
}

export type GraphNode = {
  id: string
  type?: string
  group?: string
  source_refs?: string[]
}

export function scoreStrength(count: number): 'weak' | 'moderate' | 'strong' {
  if (count >= 4) return 'strong'
  if (count >= 2) return 'moderate'
  return 'weak'
}

export function scoreGraphLinks(graph: { nodes: GraphNode[]; links: GraphLink[] }) {
  const nodeSourceCounts = new Map<string, number>()

  for (const node of graph.nodes || []) {
    nodeSourceCounts.set(node.id, new Set(node.source_refs || []).size)
  }

  return {
    ...graph,
    links: (graph.links || []).map(link => {
      const sourceCount = Math.max(
        nodeSourceCounts.get(String(link.source)) || 0,
        nodeSourceCounts.get(String(link.target)) || 0,
        1
      )

      const evidenceCount = link.evidence_count || sourceCount

      return {
        ...link,
        evidence_count: evidenceCount,
        source_count: sourceCount,
        strength: scoreStrength(evidenceCount)
      }
    })
  }
}
