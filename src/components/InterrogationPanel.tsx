import React from 'react'
import { BarChart3, Clipboard, Filter, Maximize2, Minimize2, Network, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { buildSystemSuggestions, computeGraphMetrics, getNodeName, pruneIsolates, resizeNodesByMode } from '../lib/graphAnalytics'

interface InterrogationPanelProps {
  graph: { nodes: any[]; links: any[]; narrative?: string }
  setGraph: React.Dispatch<React.SetStateAction<any>>
  onSelectNode?: (node: any) => void
}

export default function InterrogationPanel({ graph, setGraph, onSelectNode }: InterrogationPanelProps) {
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const metrics = React.useMemo(() => computeGraphMetrics(graph), [graph])
  const suggestions = React.useMemo(() => buildSystemSuggestions(graph), [graph])
  const types = React.useMemo(() => Object.keys(metrics.typeCounts).sort(), [metrics.typeCounts])

  const filteredNodes = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (graph.nodes || [])
      .filter(node => typeFilter === 'all' || String(node.type || node.group || 'unknown') === typeFilter)
      .filter(node => {
        if (!normalizedQuery) return true
        const haystack = [node.id, getNodeName(node), node.type, node.group, node.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .map(node => {
        const centrality = metrics.centrality.find(item => item.id === node.id)
        return { node, degree: centrality?.degree || 0, evidence: centrality?.evidence || 0 }
      })
      .sort((a, b) => b.degree - a.degree || b.evidence - a.evidence || getNodeName(a.node).localeCompare(getNodeName(b.node)))
  }, [graph.nodes, metrics.centrality, query, typeFilter])

  const applySizing = (mode: 'degree' | 'evidence' | 'hybrid' | 'reset') => {
    setGraph((prev: any) => resizeNodesByMode(prev, mode))
  }

  const isolateType = () => {
    if (typeFilter === 'all') return
    setGraph((prev: any) => {
      const keepIds = new Set((prev.nodes || []).filter((node: any) => String(node.type || node.group || 'unknown') === typeFilter).map((node: any) => node.id))
      return {
        ...prev,
        nodes: (prev.nodes || []).filter((node: any) => keepIds.has(node.id)),
        links: (prev.links || []).filter((link: any) => keepIds.has(String(link.source?.id || link.source)) && keepIds.has(String(link.target?.id || link.target))),
      }
    })
  }

  const copyFilteredCsv = async () => {
    const csv = [
      'id,name,type,degree,evidence,description',
      ...filteredNodes.map(({ node, degree, evidence }) => [
        node.id,
        getNodeName(node),
        node.type || node.group || 'unknown',
        degree,
        evidence,
        node.description || '',
      ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    await navigator.clipboard.writeText(csv)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Data Interrogation</h3>
        <p className="text-[10px] font-mono uppercase text-white/30 leading-relaxed">
          Filter, resize, prune, and inspect the lattice without losing ingestion or reporting functions.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <div className="text-2xl font-black text-white">{metrics.nodeCount}</div>
          <div className="text-[8px] font-mono uppercase text-white/40">Nodes</div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <div className="text-2xl font-black text-white">{metrics.linkCount}</div>
          <div className="text-[8px] font-mono uppercase text-white/40">Links</div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <div className="text-2xl font-black text-white">{metrics.isolatedCount}</div>
          <div className="text-[8px] font-mono uppercase text-white/40">Isolates</div>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <Search size={14} /> Query & Filter
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search IDs, names, descriptions..."
          className="w-full rounded-xl border border-white/5 bg-black/30 p-3 text-[11px] font-mono text-white/80 outline-none focus:border-[#d4af37]/50 placeholder:text-white/10"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="w-full rounded-xl border border-white/5 bg-black/30 p-3 text-[11px] font-mono uppercase text-white/70 outline-none focus:border-[#d4af37]/50"
        >
          <option value="all">All entity types</option>
          {types.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <SlidersHorizontal size={14} /> Node Size Models
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => applySizing('degree')} className="rounded-xl bg-white/5 border border-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-[#d4af37]">By degree</button>
          <button onClick={() => applySizing('evidence')} className="rounded-xl bg-white/5 border border-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-[#d4af37]">By evidence</button>
          <button onClick={() => applySizing('hybrid')} className="rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 p-3 text-[9px] font-bold uppercase tracking-widest text-[#d4af37]">Hybrid</button>
          <button onClick={() => applySizing('reset')} className="rounded-xl bg-white/5 border border-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-white">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setGraph((prev: any) => pruneIsolates(prev))}
          className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[9px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20"
        >
          <Trash2 size={13} /> Prune isolates
        </button>
        <button
          onClick={isolateType}
          disabled={typeFilter === 'all'}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-[#d4af37] disabled:opacity-40"
        >
          <Filter size={13} /> Isolate type
        </button>
        <button
          onClick={copyFilteredCsv}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-[#d4af37]"
        >
          <Clipboard size={13} /> Copy CSV
        </button>
        <button
          onClick={() => applySizing('hybrid')}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-[#d4af37]"
        >
          <Maximize2 size={13} /> Emphasize hubs
        </button>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <BarChart3 size={14} /> System Suggestions
        </div>
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="rounded-xl bg-black/20 border border-white/5 p-3 text-[10px] font-mono uppercase leading-relaxed text-white/40">
              {suggestion}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          <Network size={14} /> Ranked Nodes ({filteredNodes.length})
        </div>
        <div className="max-h-[360px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {filteredNodes.map(({ node, degree, evidence }) => (
            <button
              key={node.id}
              onClick={() => onSelectNode?.(node)}
              className="w-full rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left hover:border-[#d4af37]/30 hover:bg-[#d4af37]/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-white/80 truncate">{getNodeName(node)}</div>
                  <div className="text-[8px] font-mono uppercase text-white/30 mt-1">{node.type || node.group || 'unknown'} · degree {degree} · evidence {evidence}</div>
                </div>
                <Minimize2 size={12} className="text-white/20" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
