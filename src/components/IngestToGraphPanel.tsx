import { useState, useRef } from 'react'
import { mergeGraphs } from '../lib/intelligenceGraph'
import { extractIntelligenceFromText, extractIntelligenceFromUrl, extractIntelligenceFromCsv } from '../services/geminiService'
import { FileText, Link as LinkIcon, Upload, Search, Check, AlertCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

export default function IngestToGraphPanel({ setGraph }: any) {
  const [ingestType, setIngestType] = useState<'text' | 'url' | 'file'>('text')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleIngest = async () => {
    if (!inputValue.trim() && ingestType !== 'file') return
    
    setLoading(true)
    setSuccess(false)
    try {
      let result;
      if (ingestType === 'text') {
        result = await extractIntelligenceFromText(inputValue)
      } else if (ingestType === 'url') {
        result = await extractIntelligenceFromUrl(inputValue)
      } else {
        // File handling is usually triggered by onchange, but we can do a button check if needed
        throw new Error("Please select a file to ingest.")
      }
      
      setGraph((prev: any) => mergeGraphs(prev, result))
      setSuccess(true)
      setInputValue('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to ingest intelligence.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setSuccess(false)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string
        let result;
        try {
          if (file.name.endsWith('.csv')) {
            result = await extractIntelligenceFromCsv(content)
          } else {
            result = await extractIntelligenceFromText(content)
          }
          setGraph((prev: any) => mergeGraphs(prev, result))
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
          console.error(err)
          alert(err.message || 'File ingestion failed.')
        } finally {
          setLoading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
      reader.readAsText(file)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'File read failed.')
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Ingest Anything</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setIngestType('text')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'text' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <FileText size={18} />
            <span className="text-[9px] font-bold uppercase">Notes</span>
          </button>
          <button
            onClick={() => setIngestType('url')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'url' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <LinkIcon size={18} />
            <span className="text-[9px] font-bold uppercase">URL</span>
          </button>
          <button
            onClick={() => setIngestType('file')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'file' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <Upload size={18} />
            <span className="text-[9px] font-bold uppercase">File</span>
          </button>
        </div>
      </div>

      <div className="relative group">
        <AnimatePresence mode="wait">
          {ingestType === 'text' && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <textarea
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 transition-all resize-none font-mono leading-relaxed"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Paste investigative notes, transcripts, or leaked communications..."
              />
            </motion.div>
          )}

          {ingestType === 'url' && (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input
                  type="url"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 transition-all font-mono"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="https://example.com/report"
                  onKeyDown={e => e.key === 'Enter' && handleIngest()}
                />
              </div>
              <p className="px-2 text-[9px] font-mono text-white/20 uppercase tracking-tighter">
                Engine will visit and extract entity data from the targeted domain.
              </p>
            </motion.div>
          )}

          {ingestType === 'file' && (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-white/[0.07] hover:border-green-500/30 transition-all group"
            >
              <div className="p-4 rounded-full bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                <Upload className="text-white/40 group-hover:text-green-500/50" size={24} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Local Asset</p>
              <p className="text-[9px] font-mono text-white/20 mt-1 uppercase">Supports all text-based files</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {ingestType !== 'file' && (
        <button
          onClick={handleIngest}
          disabled={loading || !inputValue.trim()}
          className="w-full relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl bg-white text-black py-4 text-xs font-bold uppercase tracking-widest hover:bg-green-400 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : success ? (
            <Check size={16} />
          ) : (
            <Search size={16} />
          )}
          {loading ? 'Analyzing Intel...' : success ? 'Evidence Integrated' : 'Injest to Engine'}
          
          {loading && (
            <div className="absolute inset-0 bg-white/10 animate-[shimmer_2s_infinite]">
              <div className="h-full w-20 bg-black/5 -skew-x-12 blur-md" />
            </div>
          )}
        </button>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-black">
            <Check size={10} strokeWidth={4} />
          </div>
          <span className="text-[10px] font-bold uppercase text-green-500 tracking-wider">Lattice update complete</span>
        </motion.div>
      )}
    </div>
  )
}
