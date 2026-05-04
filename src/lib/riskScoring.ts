export function scoreRisk(graph: any) {
  const riskyKeywords = [
    'threat',
    'kill',
    'violence',
    'rape',
    'attack',
    'weapon',
    'danger',
    'urgent'
  ]

  return (graph.nodes || []).map((node: any) => {
    const text = (node.label || '').toLowerCase()

    let risk = 0

    for (const word of riskyKeywords) {
      if (text.includes(word)) risk += 5
    }

    if (node.source_refs?.length > 2) risk += 3

    if (node.type === 'fact') risk += 2

    return {
      ...node,
      risk_score: risk,
      risk_level:
        risk >= 10 ? 'high' : risk >= 5 ? 'medium' : 'low'
    }
  })
}
