export function clusterByEntity(graph: any) {
  const clusters: Record<string, any[]> = {}

  for (const node of graph.nodes || []) {
    if (!node.group || node.group === 'source') continue

    const key = node.group
    if (!clusters[key]) clusters[key] = []
    clusters[key].push(node)
  }

  return clusters
}

export function clusterBySource(graph: any) {
  const clusters: Record<string, any[]> = {}

  for (const node of graph.nodes || []) {
    const refs = node.source_refs || []
    for (const ref of refs) {
      if (!clusters[ref]) clusters[ref] = []
      clusters[ref].push(node)
    }
  }

  return clusters
}

export function clusterByConnectivity(graph: any) {
  const visited = new Set()
  const clusters: any[] = []

  function dfs(nodeId: string, cluster: Set<string>) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    cluster.add(nodeId)

    for (const link of graph.links || []) {
      if (link.source === nodeId) dfs(String(link.target), cluster)
      if (link.target === nodeId) dfs(String(link.source), cluster)
    }
  }

  for (const node of graph.nodes || []) {
    if (!visited.has(node.id)) {
      const cluster = new Set<string>()
      dfs(String(node.id), cluster)

      clusters.push(
        [...cluster].map(id =>
          graph.nodes.find((n: any) => String(n.id) === id)
        )
      )
    }
  }

  return clusters
}
