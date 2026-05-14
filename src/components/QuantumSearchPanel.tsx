import { FormEvent, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

type QuantumSearchPanelProps = {
  isSearching: boolean
  onSearch: (query: string) => Promise<void> | void
}

export default function QuantumSearchPanel({ isSearching, onSearch }: QuantumSearchPanelProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isSearching) return
    await onSearch(trimmed)
    setQuery('')
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Quantum Search</h3>
        <p className="text-[11px] leading-relaxed text-white/40 font-mono">
          Launch a deep intelligence search and merge the discovered entities into the active graph.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Entity, domain, handle, or lead..."
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-4 pl-12 pr-4 font-mono text-sm text-white placeholder:text-white/15 focus:border-[#d4af37]/50 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSearching || !query.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 py-3 text-[10px] font-bold uppercase tracking-widest text-[#d4af37] transition-all hover:bg-[#d4af37]/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Execute Quantum Sweep
      </button>
    </form>
  )
}
