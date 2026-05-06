/**
 * QuantumSearchPanel.tsx
 *
 * Wires the Nexus frontend to the nexus-backend pgvector semantic search
 * endpoint (POST /api/search/quantum). Results are displayed inline and
 * can be injected into the active intelligence graph.
 *
 * The backend URL is read from VITE_BACKEND_URL at build time.
 * If the env var is absent the panel gracefully degrades with a config notice.
 */

import { useState } from 'react'
import { Cpu, Search, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Zap, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { mergeGraphs } from '../lib/intelligenceGraph'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QuantumResult {
  fileId: string
  fileName: string
  source: string
  investigationId: string | null
  semanticScore: number
  avgConfidenceScore: number | null
  snippet: string | null
  dataPointCount: number
  topEntities: Array<{ type: string; value: string }>
}

interface QuantumResponse {
  query: string
  resultCount: number
  results: QuantumResult[]
  searchMethod: string
  model: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined

function scoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-[#d4af37]'
  if (score >= 0.4) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 0.8) return 'bg-green-500/10 border-green-500/20'
  if (score >= 0.6) return 'bg-[#d4af37]/10 border-[#d4af37]/20'
  if (score >= 0.4) return 'bg-orange-500/10 border-orange-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

// Convert a QuantumResult into a minimal graph node so it can be merged
function resultToGraphNode(r: QuantumResult) {
  return {
    nodes: [
      {
        id: `qsrc_${r.fileId}`,
        name: r.fileName,
        type: 'other' as const,
        description: r.snippet || `Quantum match — score ${r.semanticScore}`,
        val: Math.round(r.semanticScore * 10),
        source_refs: [r.source || 'quantum_search'],
      },
      ...r.topEntities.map((e, i) => ({
        id: `qent_${r.fileId}_${i}`,
        name: e.value,
        type: (e.type === 'location' ? 'location' : 'person') as any,
        description: `Entity from ${r.fileName}`,
        val: 4,
        source_refs: [`qsrc_${r.fileId}`],
      })),
    ],
    links: r.topEntities.map((_, i) => ({
      source: `qsrc_${r.fileId}`,
      target: `qent_${r.fileId}_${i}`,
      relationship: 'contains_entity',
      strength: r.semanticScore,
    })),
    narrative: r.snippet || undefined,
    centralNode: r.fileName,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function QuantumSearchPanel({ setGraph }: { setGraph: (fn: (prev: any) => any) => void }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<QuantumResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [injectedIds, setInjectedIds] = useState<Set<string>>(new Set())

  const runSearch = async () => {
    if (!query.trim() || !BACKEND_URL) return
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/search/quantum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 10, threshold: 0.35 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Backend error ${res.status}`)
      setResponse(data)
    } catch (err: any) {
      setError(err.message || 'Quantum search failed')
    } finally {
      setLoading(false)
    }
  }

  const injectResult = (r: QuantumResult) => {
    const graphPatch = resultToGraphNode(r)
    setGraph((prev: any) => mergeGraphs(prev, graphPatch))
    setInjectedIds(prev => new Set([...prev, r.fileId]))
  }

  const injectAll = () => {
    if (!response) return
    response.results.forEach(r => {
      const graphPatch = resultToGraphNode(r)
      setGraph((prev: any) => mergeGraphs(prev, graphPatch))
    })
    setInjectedIds(new Set(response.results.map(r => r.fileId)))
  }

  // ── No backend configured ────────────────────────────────────────────────
  if (!BACKEND_URL) {
    return (
      <div className="p-6 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Quantum Intel Search</h3>
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-3">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertCircle size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Backend Not Configured</span>
          </div>
          <p className="text-[10px] font-mono text-white/40 leading-relaxed">
            Quantum Intel Search requires the <span className="text-[#d4af37]">nexus-backend</span> service
            (pgvector + OpenAI embeddings). Set the <code className="bg-white/10 px-1 rounded">VITE_BACKEND_URL</code> environment
            variable to your deployed backend URL to enable semantic search across all ingested intelligence files.
          </p>
          <div className="text-[9px] font-mono text-white/20 bg-white/5 rounded-xl p-3 leading-relaxed">
            <p className="text-white/40 mb-1">In .env:</p>
            <p>VITE_BACKEND_URL=https://your-nexus-backend.onrender.com</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-[#d4af37]/10">
          <Zap size={14} className="text-[#d4af37]" />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Quantum Intel Search</h3>
      </div>

      {/* Search input */}
      <div className="relative">
        <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch()}
          placeholder="Semantic query across all ingested files…"
          className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-[#d4af37]/40 transition-all font-mono"
        />
      </div>

      <button
        onClick={runSearch}
        disabled={loading || !query.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#d4af37] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        {loading ? 'Searching Vector Space…' : 'Run Quantum Search'}
      </button>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono"
        >
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-widest text-white/30">
                {response.resultCount} result{response.resultCount !== 1 ? 's' : ''} · {response.searchMethod.replace(/_/g, ' ')}
              </span>
              {response.resultCount > 0 && (
                <button
                  onClick={injectAll}
                  className="text-[9px] font-mono uppercase tracking-widest text-[#d4af37]/60 hover:text-[#d4af37] transition-colors"
                >
                  Inject all →
                </button>
              )}
            </div>

            {response.resultCount === 0 && (
              <div className="text-center py-8 text-white/20">
                <Cpu size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-mono uppercase">No matching intelligence found</p>
                <p className="text-[9px] font-mono mt-1">Try a broader query or lower the similarity threshold</p>
              </div>
            )}

            {response.results.map(r => (
              <div
                key={r.fileId}
                className={`rounded-2xl border transition-all ${scoreBg(r.semanticScore)}`}
              >
                {/* Result header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === r.fileId ? null : r.fileId)}
                >
                  <div className="shrink-0">
                    <div className={`text-xs font-black font-mono ${scoreColor(r.semanticScore)}`}>
                      {Math.round(r.semanticScore * 100)}%
                    </div>
                    <div className="text-[8px] font-mono text-white/20 uppercase">match</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">{r.fileName}</p>
                    <p className="text-[9px] font-mono text-white/30 truncate">
                      {r.dataPointCount} data points
                      {r.avgConfidenceScore != null && ` · ${r.avgConfidenceScore}% confidence`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {injectedIds.has(r.fileId) ? (
                      <CheckCircle size={14} className="text-green-400" />
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); injectResult(r) }}
                        className="text-[9px] font-mono uppercase text-[#d4af37]/60 hover:text-[#d4af37] transition-colors px-2 py-1 rounded-lg hover:bg-[#d4af37]/10"
                      >
                        Inject
                      </button>
                    )}
                    {expandedId === r.fileId ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expandedId === r.fileId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                        {r.snippet && (
                          <p className="text-[10px] font-mono text-white/40 leading-relaxed line-clamp-4">
                            {r.snippet}
                          </p>
                        )}
                        {r.topEntities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.topEntities.map((e, i) => (
                              <span
                                key={i}
                                className="text-[8px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40"
                              >
                                {e.type}: {e.value}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.source && (
                          <p className="text-[9px] font-mono text-white/20">
                            Source: {r.source}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            <p className="text-[8px] font-mono text-white/15 text-center uppercase tracking-widest pt-1">
              Model: {response.model} · pgvector cosine similarity
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
