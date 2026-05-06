import { useState, useRef } from 'react'
import { mergeGraphs } from '../lib/intelligenceGraph'
import { extractIntelligenceFromText, extractIntelligenceFromUrl } from '../services/geminiService'
import { apiUrl } from '../services/apiBase'
import { FileText, Link as LinkIcon, Upload, Search, Check, Loader2, File } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

// ---------------------------------------------------------------------------
// Upload any file to the server-side universal parser
// ---------------------------------------------------------------------------
async function uploadFileForIntelligence(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    body: formData,
  })
  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Server returned non-JSON response — check server logs.')
  }
  if (!response.ok) {
    throw new Error(data?.error || `Upload failed (${response.status})`)
  }
  return data
}

export default function IngestToGraphPanel({ setGraph }: any) {
  const [ingestType, setIngestType] = useState<'text' | 'url' | 'file'>('text')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleIngest = async () => {
    if (ingestType === 'file') {
      if (!selectedFile) return
      await handleFileProcess(selectedFile)
      return
    }
    if (!inputValue.trim()) return
    setLoading(true)
    setSuccess(false)
    try {
      let result: any
      if (ingestType === 'text') {
        result = await extractIntelligenceFromText(inputValue)
      } else {
        result = await extractIntelligenceFromUrl(inputValue)
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

  const handleFileProcess = async (file: File) => {
    setLoading(true)
    setSuccess(false)
    try {
      const result = await uploadFileForIntelligence(file)
      setGraph((prev: any) => mergeGraphs(prev, result))
      setSuccess(true)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'File ingestion failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setIngestType('file')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Ingest Anything</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setIngestType('text')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'text' ? 'bg-[#d4af37]/10 border-[#d4af37]/50 text-[#d4af37]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <FileText size={18} />
            <span className="text-[9px] font-bold uppercase">Evidence</span>
          </button>
          <button
            onClick={() => setIngestType('url')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'url' ? 'bg-[#d4af37]/10 border-[#d4af37]/50 text-[#d4af37]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <LinkIcon size={18} />
            <span className="text-[9px] font-bold uppercase">Domain</span>
          </button>
          <button
            onClick={() => setIngestType('file')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${ingestType === 'file' ? 'bg-[#d4af37]/10 border-[#d4af37]/50 text-[#d4af37]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <Upload size={18} />
            <span className="text-[9px] font-bold uppercase">Asset</span>
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
                className="w-full h-40 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-[#d4af37]/40 transition-all resize-none font-serif italic leading-relaxed"
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
                  className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-[#d4af37]/40 transition-all font-mono"
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
              className="space-y-3"
            >
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all group
                  ${dragOver
                    ? 'bg-[#d4af37]/10 border-[#d4af37]/60'
                    : selectedFile
                      ? 'bg-white/[0.05] border-[#d4af37]/30'
                      : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-[#d4af37]/30'
                  }`}
              >
                {selectedFile ? (
                  <>
                    <div className="p-3 rounded-full bg-[#d4af37]/10 mb-2">
                      <File className="text-[#d4af37]" size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider text-center truncate max-w-full px-2">
                      {selectedFile.name}
                    </p>
                    <p className="text-[9px] font-mono text-white/30 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to inject
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-full bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="text-white/40 group-hover:text-[#d4af37]/50" size={24} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Drop or Select Any File
                    </p>
                    <p className="text-[9px] font-mono text-white/20 mt-1 text-center leading-relaxed">
                      PDF · DOCX · CSV · XLS · TXT · JSON · ZIP<br />
                      Images · Audio · Video · Code · Any format
                    </p>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="*/*"
                />
              </div>

              {/* Clear button if file selected */}
              {selectedFile && (
                <button
                  onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="w-full text-[9px] font-mono text-white/20 hover:text-white/40 uppercase tracking-widest py-1 transition-colors"
                >
                  ✕ Clear selection
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inject button — shown for all modes */}
      <button
        onClick={handleIngest}
        disabled={loading || (ingestType === 'file' ? !selectedFile : !inputValue.trim())}
        className="w-full relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl bg-white text-black py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#d4af37] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : success ? (
          <Check size={16} />
        ) : (
          <Search size={16} />
        )}
        {loading ? 'Analyzing Intel...' : success ? 'Evidence Integrated' : 'Inject to Engine'}

        {loading && (
          <div className="absolute inset-0 bg-white/10 animate-[shimmer_2s_infinite]">
            <div className="h-full w-20 bg-black/5 -skew-x-12 blur-md" />
          </div>
        )}
      </button>

      {success && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d4af37] text-black">
            <Check size={10} strokeWidth={4} />
          </div>
          <span className="text-[10px] font-bold uppercase text-[#d4af37] tracking-wider">Lattice update complete</span>
        </motion.div>
      )}
    </div>
  )
}
