// Sneaky clue finders: orphan artefacts, bursts, duplicates, rare entities, timeline gaps, mismatches

export function findOrphans(graph: any) {
  const connected = new Set()
  for (const l of graph.links || []) {
    connected.add(String(l.source))
    connected.add(String(l.target))
  }
  return (graph.nodes || []).filter((n: any) => !connected.has(String(n.id)))
}

export function findBursts(graph: any, windowMs = 5 * 60 * 1000) {
  const nodes = (graph.nodes || []).map((n: any) => ({ n, t: new Date(n.label || n.createdAt || 0).getTime() }))
    .filter((x: any) => !isNaN(x.t))
    .sort((a: any, b: any) => a.t - b.t)

  const bursts: any[] = []
  let current: any[] = []

  for (let i = 0; i < nodes.length; i++) {
    if (!current.length) current.push(nodes[i])
    else if (nodes[i].t - current[current.length - 1].t <= windowMs) current.push(nodes[i])
    else {
      if (current.length >= 3) bursts.push(current.map(x => x.n.id))
      current = [nodes[i]]
    }
  }
  if (current.length >= 3) bursts.push(current.map(x => x.n.id))
  return bursts
}

export function findDuplicateLike(graph: any) {
  const map = new Map<string, any[]>()
  for (const n of graph.nodes || []) {
    const key = (n.label || '').toLowerCase().slice(0, 80)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  return [...map.values()].filter(arr => arr.length > 1)
}

export function findRareEntities(graph: any) {
  return (graph.nodes || []).filter((n: any) => (n.source_refs || []).length === 1 && (n.group !== 'source'))
}

export function findTimelineGaps(graph: any) {
  const times = (graph.nodes || [])
    .map((n: any) => new Date(n.label || n.createdAt || 0).getTime())
    .filter((t: number) => !isNaN(t))
    .sort((a: number, b: number) => a - b)

  const gaps: any[] = []
  for (let i = 1; i < times.length; i++) {
    const diff = times[i] - times[i - 1]
    if (diff > 1000 * 60 * 60 * 24) {
      gaps.push({ from: new Date(times[i - 1]), to: new Date(times[i]), gapMs: diff })
    }
  }
  return gaps
}

export function findMetadataMismatches(graph: any) {
  const issues: any[] = []
  for (const n of graph.nodes || []) {
    const a = n.createdAt && new Date(n.createdAt).getTime()
    const b = n.photo_taken_time && new Date(n.photo_taken_time).getTime()
    if (a && b && Math.abs(a - b) > 1000 * 60 * 60 * 24) {
      issues.push({ id: n.id, createdAt: n.createdAt, photoTaken: n.photo_taken_time })
    }
  }
  return issues
}

export function findRepeatedNumbers(graph: any) {
  const map = new Map<string, any[]>()
  for (const n of graph.nodes || []) {
    if (n.group === 'phone' || n.type === 'phone') {
      const key = (n.label || '').replace(/\s+/g, '')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
  }
  return [...map.values()].filter(arr => arr.length > 1)
}
