type GraphData = {
  nodes: any[]
  links: any[]
}

type CorroborationPanelProps = {
  graph: GraphData
}

export default function CorroborationPanel({ graph }: CorroborationPanelProps) {
  const strongestLinks = [...graph.links]
    .sort((a, b) => Number(b.strength ?? b.weight ?? 0) - Number(a.strength ?? a.weight ?? 0))
    .slice(0, 8)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Corroboration</h3>
        <p className="text-[11px] leading-relaxed text-white/40 font-mono">
          Review the graph&apos;s strongest relationships and confirm cross-source correlation candidates.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="text-2xl font-black text-white">{graph.nodes.length}</div>
          <div className="text-[9px] uppercase tracking-widest text-white/35 font-mono">Entities</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="text-2xl font-black text-white">{graph.links.length}</div>
          <div className="text-[9px] uppercase tracking-widest text-white/35 font-mono">Correlations</div>
        </div>
      </div>

      <div className="space-y-2">
        {strongestLinks.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center text-[10px] uppercase tracking-widest text-white/25 font-mono">
            No correlations to corroborate yet
          </div>
        ) : (
          strongestLinks.map((link, index) => (
            <div key={`${link.source}-${link.target}-${index}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <div className="text-xs font-bold text-white/80 truncate">{String(link.source)} → {String(link.target)}</div>
              <div className="mt-1 text-[10px] text-white/35 font-mono uppercase tracking-wider truncate">
                {link.relationship || link.type || 'Relationship'} · Confidence {Math.round(Number(link.strength ?? link.weight ?? 1) * 100)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
