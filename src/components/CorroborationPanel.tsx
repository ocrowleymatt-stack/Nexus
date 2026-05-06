/**
 * CorroborationPanel.tsx
 *
 * Connects the core/store.ts corroboration model to the live intelligence
 * graph. Surfaces:
 *   - Claims with their evidential status, supporting/contradicting sources
 *   - Contradictions with severity badges
 *   - Entities with confidence levels
 *
 * Any claim or entity can be injected into the active graph as a node.
 * The panel also reads the current graph to cross-reference node names
 * against the store, highlighting which graph nodes have corroboration data.
 */

import { useState, useEffect } from 'react'
import { store } from '../core/store'
import type { ClaimRecord, EntityRecord, ContradictionRecord } from '../core/types'
import { mergeGraphs } from '../lib/intelligenceGraph'
import { Check, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, RefreshCw, BookOpen, Users, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  proven: 'bg-green-500/10 border-green-500/30 text-green-400',
  probable: 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]',
  possible: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  disputed: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  contradicted: 'bg-red-500/10 border-red-500/30 text-red-400',
  untested: 'bg-white/5 border-white/10 text-white/30',
  requires_primary_source_check: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/10 border-red-500/30 text-red-400',
  medium: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  low: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'text-green-400',
  moderate: 'text-[#d4af37]',
  mixed: 'text-orange-400',
  low: 'text-red-400',
}

type TabKey = 'claims' | 'contradictions' | 'entities'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CorroborationPanel({
  graph,
  setGraph,
}: {
  graph: { nodes: any[]; links: any[]; narrative?: string; centralNode?: string }
  setGraph: (fn: (prev: any) => any) => void
}) {
  const [tab, setTab] = useState<TabKey>('claims')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [injectedIds, setInjectedIds] = useState<Set<string>>(new Set())
  const [tick, setTick] = useState(0) // force re-render when store changes

  // Refresh view when store is updated externally (e.g. after ingest)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const claims = store.claims as ClaimRecord[]
  const contradictions = store.contradictions as ContradictionRecord[]
  const entities = store.entities as EntityRecord[]

  // Cross-reference: which graph node names appear in the store?
  const graphNodeNames = new Set(graph.nodes.map(n => (n.name || n.id || '').toLowerCase()))
  const corroboratedNodeIds = new Set(
    graph.nodes
      .filter(n => graphNodeNames.has((n.name || n.id || '').toLowerCase()))
      .map(n => n.id)
  )

  // Inject a claim as a node into the graph
  const injectClaim = (claim: ClaimRecord) => {
    const patch = {
      nodes: [
        {
          id: `claim_${claim.claim_id}`,
          name: claim.claim.slice(0, 60) + (claim.claim.length > 60 ? '…' : ''),
          type: 'other' as const,
          description: `${claim.category} · ${claim.status} · ${claim.confidence} confidence\n${claim.safe_wording}`,
          val: claim.confidence === 'high' ? 8 : claim.confidence === 'moderate' ? 5 : 3,
          source_refs: claim.supporting_sources,
        },
      ],
      links: [],
      narrative: undefined,
      centralNode: undefined,
    }
    setGraph((prev: any) => mergeGraphs(prev, patch))
    setInjectedIds(prev => new Set([...prev, claim.claim_id]))
  }

  // Inject an entity as a node into the graph
  const injectEntity = (entity: EntityRecord) => {
    const patch = {
      nodes: [
        {
          id: `ent_${entity.entity_id}`,
          name: entity.name,
          type: (entity.entity_type === 'person' ? 'person' :
                 entity.entity_type === 'organisation' ? 'organization' :
                 entity.entity_type === 'place' ? 'location' : 'other') as any,
          description: `Aliases: ${entity.aliases.join(', ') || 'none'} · Confidence: ${entity.confidence}`,
          val: entity.confidence === 'high' ? 8 : entity.confidence === 'moderate' ? 5 : 3,
          source_refs: entity.source_refs,
        },
      ],
      links: [],
      narrative: undefined,
      centralNode: undefined,
    }
    setGraph((prev: any) => mergeGraphs(prev, patch))
    setInjectedIds(prev => new Set([...prev, entity.entity_id]))
  }

  const isEmpty = claims.length === 0 && contradictions.length === 0 && entities.length === 0

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-[#d4af37]/10">
          <BookOpen size={14} className="text-[#d4af37]" />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Corroboration Engine</h3>
        <button
          onClick={() => setTick(t => t + 1)}
          className="ml-auto p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-white/60 transition-colors"
          title="Refresh store"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {isEmpty ? (
        <div className="text-center py-10 space-y-3">
          <BookOpen size={32} className="mx-auto text-white/10" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/20">No corroboration data</p>
          <p className="text-[9px] font-mono text-white/15 leading-relaxed px-4">
            Ingest text via the Evidence tab or the Ingest route to populate claims, entities, and contradictions.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1">
            {([
              { key: 'claims', label: 'Claims', count: claims.length, icon: <Zap size={12} /> },
              { key: 'contradictions', label: 'Conflicts', count: contradictions.length, icon: <AlertTriangle size={12} /> },
              { key: 'entities', label: 'Entities', count: entities.length, icon: <Users size={12} /> },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                  tab === t.key
                    ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]'
                    : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'
                }`}
              >
                {t.icon}
                <span className="text-[8px] font-bold uppercase tracking-widest">{t.label}</span>
                <span className="text-[9px] font-mono font-black">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Summary stats */}
          {tab === 'claims' && claims.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {(['proven', 'disputed', 'contradicted'] as const).map(status => {
                const count = claims.filter(c => c.status === status).length
                return (
                  <div key={status} className={`rounded-xl border p-2 text-center ${STATUS_STYLES[status] || 'bg-white/5 border-white/5 text-white/30'}`}>
                    <div className="text-lg font-black">{count}</div>
                    <div className="text-[8px] font-mono uppercase tracking-widest opacity-70">{status}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Claims list */}
          {tab === 'claims' && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {claims.length === 0 && (
                <p className="text-[10px] font-mono text-white/20 text-center py-6">No claims recorded</p>
              )}
              {claims.map(claim => (
                <div
                  key={claim.claim_id}
                  className={`rounded-2xl border transition-all ${STATUS_STYLES[claim.status] || 'bg-white/5 border-white/5'}`}
                >
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === claim.claim_id ? null : claim.claim_id)}
                  >
                    <div className="shrink-0 mt-0.5">
                      {claim.status === 'proven' && <Check size={12} />}
                      {claim.status === 'contradicted' && <AlertCircle size={12} />}
                      {claim.status === 'disputed' && <AlertTriangle size={12} />}
                      {!['proven', 'contradicted', 'disputed'].includes(claim.status) && (
                        <div className="w-3 h-3 rounded-full border border-current opacity-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono leading-snug line-clamp-2">{claim.claim}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-mono uppercase opacity-60">{claim.category}</span>
                        <span className="text-[8px] font-mono uppercase opacity-60">·</span>
                        <span className={`text-[8px] font-mono uppercase ${CONFIDENCE_STYLES[claim.confidence] || 'text-white/30'}`}>
                          {claim.confidence}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {injectedIds.has(claim.claim_id) ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); injectClaim(claim) }}
                          className="text-[8px] font-mono uppercase px-2 py-1 rounded-lg hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
                        >
                          +Graph
                        </button>
                      )}
                      {expandedId === claim.claim_id ? <ChevronUp size={10} className="opacity-40" /> : <ChevronDown size={10} className="opacity-40" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === claim.claim_id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-2">
                          <p className="text-[9px] font-mono text-white/50 leading-relaxed">{claim.safe_wording}</p>
                          {claim.supporting_sources.length > 0 && (
                            <div>
                              <p className="text-[8px] font-mono uppercase text-green-400/60 mb-1">Supporting ({claim.supporting_sources.length})</p>
                              <div className="flex flex-wrap gap-1">
                                {claim.supporting_sources.map(s => (
                                  <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400/70">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {claim.contradicting_sources.length > 0 && (
                            <div>
                              <p className="text-[8px] font-mono uppercase text-red-400/60 mb-1">Contradicting ({claim.contradicting_sources.length})</p>
                              <div className="flex flex-wrap gap-1">
                                {claim.contradicting_sources.map(s => (
                                  <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400/70">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Contradictions list */}
          {tab === 'contradictions' && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {contradictions.length === 0 && (
                <p className="text-[10px] font-mono text-white/20 text-center py-6">No contradictions recorded</p>
              )}
              {contradictions.map(c => (
                <div
                  key={c.contradiction_id}
                  className={`rounded-2xl border p-3 space-y-2 ${SEVERITY_STYLES[c.severity] || 'bg-white/5 border-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} />
                      <span className="text-[11px] font-bold">{c.title}</span>
                    </div>
                    <span className={`text-[8px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                      c.status === 'open' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      c.status === 'resolved' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      'bg-white/5 border-white/10 text-white/30'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-current opacity-60 leading-relaxed">{c.description}</p>
                  {c.source_refs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.source_refs.map(s => (
                        <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/30">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Entities list */}
          {tab === 'entities' && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {entities.length === 0 && (
                <p className="text-[10px] font-mono text-white/20 text-center py-6">No entities recorded</p>
              )}
              {entities.map(entity => {
                const inGraph = graph.nodes.some(n =>
                  (n.name || '').toLowerCase() === entity.name.toLowerCase()
                )
                return (
                  <div
                    key={entity.entity_id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      inGraph ? 'bg-[#d4af37]/5 border-[#d4af37]/20' : 'bg-white/[0.03] border-white/5'
                    }`}
                  >
                    <div className="shrink-0">
                      <div className={`text-[8px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                        entity.entity_type === 'person' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        entity.entity_type === 'organisation' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                        entity.entity_type === 'place' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        'bg-white/5 border-white/10 text-white/30'
                      }`}>
                        {entity.entity_type}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{entity.name}</p>
                      {entity.aliases.length > 0 && (
                        <p className="text-[9px] font-mono text-white/30 truncate">aka: {entity.aliases.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[8px] font-mono uppercase ${CONFIDENCE_STYLES[entity.confidence] || 'text-white/30'}`}>
                        {entity.confidence}
                      </span>
                      {inGraph ? (
                        <span className="text-[8px] font-mono text-[#d4af37]/60 uppercase">In graph</span>
                      ) : injectedIds.has(entity.entity_id) ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <button
                          onClick={() => injectEntity(entity)}
                          className="text-[8px] font-mono uppercase px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"
                        >
                          +Graph
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
