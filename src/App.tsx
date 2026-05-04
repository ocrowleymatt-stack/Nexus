import { useState } from 'react'
import { RotateCcw, Network, FileText } from 'lucide-react'
import IngestToGraphPanel from './components/IngestToGraphPanel'
import { NetworkMap } from './components/NetworkMap'

type GraphData = {
  nodes: any[]
  links: any[]
}

const initialGraph: GraphData = {
  nodes: [],
  links: []
}

export default function App() {
  const [graph, setGraph] = useState<GraphData>(initialGraph)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)

  const reset = () => {
    setGraph(initialGraph)
    setSelectedNode(null)
  }

  const graphForMap = {
    centralNode: 'Nexus Intelligence Core',
    narrative: 'Live source-linked claim graph generated through the ingest pipeline.',
    nodes: graph.nodes,
    links: graph.links
  }

  return (
    <div className="relative flex h-screen w-screen bg-[#050505] text-white selection:bg-green-500 selection:text-black">
      <aside className="z-10 w-[360px] shrink-0 border-r border-white/10 bg-black/70 backdrop-blur-md">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
            <Network size={18} className="text-green-500" />
            Nexus
          </div>
          <p className="mt-2 text-xs leading-5 text-white/50">
            Evidence & Narrative Engine. Paste source material, create source-linked claims, and build the graph.
          </p>
        </div>

        <IngestToGraphPanel setGraph={setGraph} />

        <div className="border-t border-white/10 p-4 text-xs text-white/60">
          <div className="flex items-center gap-2 font-mono uppercase text-white/40">
            <FileText size={14} />
            Current Graph
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 p-3">
              <div className="text-2xl font-bold text-white">{graph.nodes.length}</div>
              <div className="font-mono uppercase text-white/40">Nodes</div>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="text-2xl font-bold text-white">{graph.links.length}</div>
              <div className="font-mono uppercase text-white/40">Links</div>
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={14} />
            Reset Graph
          </button>
        </div>
      </aside>

      <main className="relative flex-1">
        {graph.nodes.length > 0 ? (
          <NetworkMap
            data={graphForMap as any}
            onNodeClick={(node: any) => setSelectedNode(node)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="select-none text-center opacity-25">
              <h1 className="font-serif text-7xl italic">Investigation</h1>
              <p className="ml-[1.5em] mt-4 font-mono uppercase tracking-[1.5em]">Awaiting Source</p>
            </div>
          </div>
        )}
      </main>

      <aside className="z-10 w-[340px] shrink-0 border-l border-white/10 bg-black/70 p-4 backdrop-blur-md">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Selection</h2>
        {selectedNode ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="text-lg font-bold">{selectedNode.label || selectedNode.id}</div>
            <div className="rounded-lg border border-white/10 p-3 font-mono text-xs text-white/60">
              <div>ID: {selectedNode.id}</div>
              <div>Type: {selectedNode.type || selectedNode.group || 'unknown'}</div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/50">Click a node to inspect it.</p>
        )}
      </aside>

      <div className="pointer-events-none fixed inset-0 opacity-[0.03]">
        <div className="h-full w-full" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>
    </div>
  )
}
