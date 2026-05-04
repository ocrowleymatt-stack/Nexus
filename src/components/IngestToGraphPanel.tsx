import { useState } from 'react'
import { buildGraphFromIngest, mergeGraphs } from '../lib/intelligenceGraph'

export default function IngestToGraphPanel({ setGraph }: any) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)

    const res = await fetch('/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Manual Input',
        text
      })
    })

    const data = await res.json()

    const graph = buildGraphFromIngest(
      data.source,
      data.claims,
      data.entities || []
    )

    setGraph((prev: any) => mergeGraphs(prev, graph))

    setLoading(false)
    setText('')
  }

  return (
    <div className="p-3 space-y-2">
      <textarea
        className="w-full h-32 text-black"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste transcript / notes / email here..."
      />

      <button
        onClick={submit}
        disabled={loading}
        className="bg-white text-black px-3 py-1"
      >
        {loading ? 'Processing...' : 'Ingest → Graph'}
      </button>
    </div>
  )
}
