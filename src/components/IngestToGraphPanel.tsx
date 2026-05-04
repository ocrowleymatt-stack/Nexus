import { useState } from 'react'
import { buildGraphFromIngest, mergeGraphs } from '../lib/intelligenceGraph'

export default function IngestToGraphPanel({ setGraph }: any) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Manual Input',
          text
        })
      })

      if (!res.ok) throw new Error('Ingest failed')

      const data = await res.json()

      const graph = buildGraphFromIngest(
        data.source,
        data.claims,
        data.entities || []
      )

      setGraph((prev: any) => mergeGraphs(prev, graph))
      setText('')
    } catch (err) {
      console.error(err)
      alert('Failed to ingest text. Please check the server connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-white/40 mb-1">
        Manual Ingest
      </div>
      <textarea
        className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 transition-colors resize-none"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste transcript / notes / intelligence updates here..."
      />

      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-black py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            Processing...
          </>
        ) : (
          'Ingest to Graph'
        )}
      </button>
    </div>
  )
}
