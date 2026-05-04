type Node = {
  id: string
  label?: string
  type?: string
  group?: string
  source_refs?: string[]
  createdAt?: string
  captured_at?: string
  photo_taken_time?: string
  file_created_at?: string
}

type Link = {
  source: string
  target: string
  relation?: string
}

type Graph = {
  nodes: Node[]
  links: Link[]
}

function parseDate(text?: string) {
  if (!text) return null
  const d = new Date(text)
  return isNaN(d.getTime()) ? null : d
}

function nodeTimestamp(node: Node) {
  return (
    parseDate(node.photo_taken_time) ||
    parseDate(node.captured_at) ||
    parseDate(node.createdAt) ||
    parseDate(node.file_created_at) ||
    parseDate(node.label)
  )
}

export function clusterBreadcrumbs(graph: Graph, windowMinutes = 10) {
  const timedNodes = (graph.nodes || [])
    .map(node => ({ node, timestamp: nodeTimestamp(node) }))
    .filter(item => item.timestamp) as { node: Node; timestamp: Date }[]

  const clusters: any[] = []
  const sorted = timedNodes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  for (const item of sorted) {
    const last = clusters[clusters.length - 1]
    const time = item.timestamp.getTime()

    if (last && Math.abs(time - last.end.getTime()) <= windowMinutes * 60 * 1000) {
      last.nodes.push(item.node.id)
      last.end = item.timestamp
    } else {
      clusters.push({
        start: item.timestamp,
        end: item.timestamp,
        nodes: [item.node.id]
      })
    }
  }

  return clusters.map((cluster, index) => ({
    id: `BRC-${index + 1}`,
    ...cluster,
    size: cluster.nodes.length,
    explanation: explainCluster(graph, cluster)
  }))
}

export function explainCluster(graph: Graph, cluster: any) {
  const nodes = (graph.nodes || []).filter(node => cluster.nodes.includes(node.id))
  const types = [...new Set(nodes.map(n => n.type || n.group || 'unknown'))]
  const labels = nodes.map(n => n.label || n.id).slice(0, 8)
  const sources = [...new Set(nodes.flatMap(n => n.source_refs || []))]

  const reasons = []
  if (nodes.length > 1) reasons.push(`${nodes.length} artefacts sit close together in time`)
  if (types.length) reasons.push(`contains: ${types.join(', ')}`)
  if (sources.length > 1) reasons.push(`crosses ${sources.length} sources`)

  return {
    summary: reasons.length ? reasons.join('; ') : 'single timed artefact',
    sample_labels: labels,
    source_count: sources.length,
    types
  }
}
