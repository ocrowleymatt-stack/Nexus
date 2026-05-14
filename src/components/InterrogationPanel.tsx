import { FormEvent, useMemo, useState } from 'react'
import { Gavel, Loader2 } from 'lucide-react'
import { testHypothesis } from '../services/geminiService'

type GraphData = {
  nodes: any[]
  links: any[]
}

type InterrogationPanelProps = {
  graph: GraphData
}

export default function InterrogationPanel({ graph }: InterrogationPanelProps) {
  const [hypothesis, setHypothesis] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const contextNodes = useMemo(
    () => graph.nodes.slice(0, 30).map((node) => node.name || node.label || node.id).filter(Boolean),
    [graph.nodes]
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = hypothesis.trim()
    if (!trimmed || loading) return

    setLoading(true)
    try {
      setReport(await testHypothesis(trimmed, contextNodes))
    } catch (err: any) {
      setReport(err.message || 'Interrogation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Query Interrogation</h3>
        <p className="text-[11px] leading-relaxed text-white/40 font-mono">
          Test an investigative hypothesis against the active graph context.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={hypothesis}
          onChange={(event) => setHypothesis(event.target.value)}
          placeholder="What connection, timeline, or contradiction should Nexus interrogate?"
          className="h-36 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder:text-white/15 focus:border-[#d4af37]/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !hypothesis.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 py-3 text-[10px] font-bold uppercase tracking-widest text-[#d4af37] transition-all hover:bg-[#d4af37]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
          Run Query
        </button>
      </form>

      {report && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-[11px] leading-relaxed text-white/60 whitespace-pre-wrap font-mono">
          {report}
        </div>
      )}
    </div>
  )
}
