export type GraphLike = {
  nodes: any[]
  links: any[]
  narrative?: string
}

export type GraphMetrics = {
  nodeCount: number
  linkCount: number
  density: number
  isolatedCount: number
  sourceBackedCount: number
  centrality: Array<{ id: string; name: string; type: string; degree: number; evidence: number }>
  typeCounts: Record<string, number>
  relationshipCounts: Record<string, number>
}

export type ReportMode = 'executive' | 'evidence' | 'gaps' | 'technical'

export function endpointId(endpoint: any): string {
  return endpoint && typeof endpoint === 'object' ? endpoint.id : String(endpoint || '')
}

export function getNodeName(node: any): string {
  return String(node?.name || node?.label || node?.id || 'Unknown')
}

export function evidenceScore(node: any): number {
  const refs = Array.isArray(node?.source_refs) ? node.source_refs.length : 0
  const hasDescription = node?.description ? 1 : 0
  const metadata = node?.metadata && typeof node.metadata === 'object' ? Object.keys(node.metadata).length : 0
  return refs + hasDescription + Math.min(metadata, 5)
}

export function computeGraphMetrics(graph: GraphLike): GraphMetrics {
  const nodes = graph?.nodes || []
  const links = graph?.links || []
  const degree = new Map<string, number>()
  const typeCounts: Record<string, number> = {}
  const relationshipCounts: Record<string, number> = {}

  for (const node of nodes) {
    degree.set(node.id, 0)
    const type = String(node.type || node.group || 'unknown')
    typeCounts[type] = (typeCounts[type] || 0) + 1
  }

  for (const link of links) {
    const source = endpointId(link.source)
    const target = endpointId(link.target)
    if (degree.has(source)) degree.set(source, (degree.get(source) || 0) + 1)
    if (degree.has(target)) degree.set(target, (degree.get(target) || 0) + 1)
    const relationship = String(link.relationship || 'connected')
    relationshipCounts[relationship] = (relationshipCounts[relationship] || 0) + 1
  }

  const centrality = nodes
    .map(node => ({
      id: node.id,
      name: getNodeName(node),
      type: String(node.type || node.group || 'unknown'),
      degree: degree.get(node.id) || 0,
      evidence: evidenceScore(node),
    }))
    .sort((a, b) => b.degree - a.degree || b.evidence - a.evidence || a.name.localeCompare(b.name))

  const possibleLinks = nodes.length > 1 ? nodes.length * (nodes.length - 1) : 1

  return {
    nodeCount: nodes.length,
    linkCount: links.length,
    density: links.length / possibleLinks,
    isolatedCount: centrality.filter(item => item.degree === 0).length,
    sourceBackedCount: centrality.filter(item => item.evidence > 0).length,
    centrality,
    typeCounts,
    relationshipCounts,
  }
}

export function buildSystemSuggestions(graph: GraphLike): string[] {
  const metrics = computeGraphMetrics(graph)
  const suggestions: string[] = []

  if (metrics.nodeCount === 0) {
    return [
      'Ingest at least one evidence source before running pattern analysis.',
      'Start with text, CSV, ZIP, or URL ingestion, then use Visuals → 3D / Pattern Templates to explore structure.',
    ]
  }

  if (metrics.isolatedCount > 0) {
    suggestions.push(`${metrics.isolatedCount} isolated node${metrics.isolatedCount === 1 ? '' : 's'} found. Review or prune isolates before final reporting.`)
  }

  if (metrics.density < 0.04 && metrics.nodeCount > 8) {
    suggestions.push('The graph is sparse. Run expansion or ingest corroborating sources to reveal missing relationships.')
  }

  if (metrics.sourceBackedCount / Math.max(1, metrics.nodeCount) < 0.5) {
    suggestions.push('Less than half of entities have explicit evidence markers. Prioritize source-backed extraction and evidence references.')
  }

  const topType = Object.entries(metrics.typeCounts).sort((a, b) => b[1] - a[1])[0]
  if (topType) {
    suggestions.push(`Dominant entity class is ${topType[0]} (${topType[1]}). Switch visual model or filter by type to test for overrepresentation.`)
  }

  const hub = metrics.centrality[0]
  if (hub && hub.degree >= 3) {
    suggestions.push(`${hub.name} is the current hub (${hub.degree} links). Stress-test whether it is a true actor, source artifact, or import bias.`)
  }

  suggestions.push('Use Fractal or Constellation layout to find repeated motifs; use 3D Iso or Helix to inspect sequencing and layered clusters.')

  return suggestions
}

export function buildLocalReport(graph: GraphLike, projectName: string, mode: ReportMode): string {
  const metrics = computeGraphMetrics(graph)
  const suggestions = buildSystemSuggestions(graph)
  const topNodes = metrics.centrality.slice(0, 10)
  const typeBreakdown = Object.entries(metrics.typeCounts).sort((a, b) => b[1] - a[1])
  const relationshipBreakdown = Object.entries(metrics.relationshipCounts).sort((a, b) => b[1] - a[1]).slice(0, 12)

  const sections: Record<ReportMode, string> = {
    executive: `# Executive Intelligence Brief: ${projectName}\n\n## Summary\n${graph.narrative || 'No narrative generated yet.'}\n\n## Key Metrics\n- Entities: ${metrics.nodeCount}\n- Relationships: ${metrics.linkCount}\n- Density: ${metrics.density.toFixed(3)}\n- Source-backed entities: ${metrics.sourceBackedCount}\n\n## Highest Leverage Nodes\n${topNodes.map(node => `- ${node.name} (${node.type}) — ${node.degree} links, evidence score ${node.evidence}`).join('\n') || '- No nodes available.'}\n\n## System Suggestions\n${suggestions.map(item => `- ${item}`).join('\n')}`,
    evidence: `# Evidence Matrix: ${projectName}\n\n## Source-backed Entity Coverage\n${metrics.sourceBackedCount}/${metrics.nodeCount} entities have evidence markers.\n\n## Entity Inventory\n${(graph.nodes || []).map(node => `- ${getNodeName(node)} (${node.type || 'unknown'}) — evidence score ${evidenceScore(node)} — ${node.description || 'No description.'}`).join('\n') || '- No entities.'}\n\n## Relationship Inventory\n${(graph.links || []).map(link => `- ${endpointId(link.source)} → ${endpointId(link.target)} — ${link.relationship || 'connected'}`).join('\n') || '- No relationships.'}`,
    gaps: `# Gap Analysis: ${projectName}\n\n## Structural Gaps\n- Isolated nodes: ${metrics.isolatedCount}\n- Sparse graph warning: ${metrics.density < 0.04 ? 'Yes' : 'No'}\n- Evidence coverage: ${metrics.sourceBackedCount}/${metrics.nodeCount}\n\n## Recommended Next Actions\n${suggestions.map(item => `- ${item}`).join('\n')}`,
    technical: `# Technical Graph Audit: ${projectName}\n\n## Type Breakdown\n${typeBreakdown.map(([type, count]) => `- ${type}: ${count}`).join('\n') || '- None'}\n\n## Relationship Breakdown\n${relationshipBreakdown.map(([relationship, count]) => `- ${relationship}: ${count}`).join('\n') || '- None'}\n\n## Centrality Ranking\n${metrics.centrality.map(node => `- ${node.id},${node.name},${node.type},degree=${node.degree},evidence=${node.evidence}`).join('\n') || '- None'}`,
  }

  return `${sections[mode]}\n\n---\nGenerated by Nexus @ ${new Date().toISOString()}`
}

export function resizeNodesByMode(graph: GraphLike, mode: 'degree' | 'evidence' | 'hybrid' | 'reset'): GraphLike {
  const metrics = computeGraphMetrics(graph)
  const degreeById = new Map(metrics.centrality.map(item => [item.id, item.degree]))
  const maxDegree = Math.max(1, ...metrics.centrality.map(item => item.degree))
  const maxEvidence = Math.max(1, ...metrics.centrality.map(item => item.evidence))

  return {
    ...graph,
    nodes: (graph.nodes || []).map(node => {
      if (mode === 'reset') return { ...node, val: 5 }
      const degree = degreeById.get(node.id) || 0
      const evidence = evidenceScore(node)
      const degreeVal = degree / maxDegree
      const evidenceVal = evidence / maxEvidence
      const score = mode === 'degree' ? degreeVal : mode === 'evidence' ? evidenceVal : (degreeVal * 0.65 + evidenceVal * 0.35)
      return { ...node, val: Math.round(5 + score * 18) }
    }),
  }
}

export function pruneIsolates(graph: GraphLike): GraphLike {
  const metrics = computeGraphMetrics(graph)
  const connectedIds = new Set(metrics.centrality.filter(item => item.degree > 0).map(item => item.id))
  return {
    ...graph,
    nodes: (graph.nodes || []).filter(node => connectedIds.has(node.id)),
    links: graph.links || [],
  }
}
