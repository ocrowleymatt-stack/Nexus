export type SearchResult = {
  node: any
  score: number
  reasons: string[]
}

function normalise(value: any) {
  return String(value || '').toLowerCase().trim()
}

function searchableText(node: any) {
  return [
    node.id,
    node.label,
    node.text,
    node.type,
    node.group,
    ...(node.source_refs || [])
  ].filter(Boolean).join(' ')
}

export function searchGraph(graph: any, query: string): SearchResult[] {
  const q = normalise(query)
  if (!q) return []

  const terms = q.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const node of graph.nodes || []) {
    const text = normalise(searchableText(node))
    let score = 0
    const reasons: string[] = []

    if (text.includes(q)) {
      score += 10
      reasons.push('exact phrase match')
    }

    for (const term of terms) {
      if (text.includes(term)) {
        score += 2
        reasons.push(`term match: ${term}`)
      }
    }

    if (node.source_refs?.length) {
      score += Math.min(node.source_refs.length, 5)
      reasons.push(`${node.source_refs.length} source reference(s)`)
    }

    if (score > 0) results.push({ node, score, reasons: [...new Set(reasons)] })
  }

  return results.sort((a, b) => b.score - a.score)
}

export function connectedSubgraph(graph: any, nodeId: string) {
  const links = (graph.links || []).filter((link: any) =>
    String(link.source) === nodeId || String(link.target) === nodeId
  )

  const ids = new Set<string>([nodeId])
  for (const link of links) {
    ids.add(String(link.source))
    ids.add(String(link.target))
  }

  return {
    nodes: (graph.nodes || []).filter((node: any) => ids.has(String(node.id))),
    links
  }
}
