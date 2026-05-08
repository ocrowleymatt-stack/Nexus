import { useState, useRef, useEffect } from 'react'
import { mergeGraphs } from '../lib/intelligenceGraph'
import { extractIntelligenceFromText, extractIntelligenceFromUrl } from '../services/geminiService'
import { FileText, Link as LinkIcon, Upload, Search, Check, Loader2, File, X, ChevronRight, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type QueueStatus = 'pending' | 'processing' | 'done' | 'error'

interface QueuedFile {
  id: string
  file: File
  status: QueueStatus
  error?: string
}

// ---------------------------------------------------------------------------
// Client-side universal file parser (no server required)
// ---------------------------------------------------------------------------
async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  // DOCX — use mammoth
  if (name.endsWith('.docx')) {
    const { default: mammoth } = await import('mammoth')
    const ab = await readFileAsArrayBuffer(file)
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    return result.value
  }

  // CSV / TSV — use papaparse
  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    const { default: Papa } = await import('papaparse')
    const text = await readFileAsText(file)
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    return JSON.stringify(parsed.data, null, 2)
  }

  // ZIP — extract and concatenate text files
  if (name.endsWith('.zip')) {
    const { default: JSZip } = await import('jszip')
    const ab = await readFileAsArrayBuffer(file)
    const zip = await JSZip.loadAsync(ab)
    const parts: string[] = []
    for (const [path, entry] of Object.entries(zip.files)) {
      if ((entry as any).dir) continue
      try {
        const content = await (entry as any).async('string')
        parts.push(`=== ${path} ===\n${content.substring(0, 3000)}`)
      } catch { /* skip binary */ }
    }
    return parts.join('\n\n').substring(0, 50000)
  }

  // PDF — read as text (browser-compatible; server handles proper PDF parsing)
  if (name.endsWith('.pdf')) {
    return await readFileAsText(file)
  }

  // XLSX — use exceljs
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { default: ExcelJS } = await import('exceljs')
    const ab = await readFileAsArrayBuffer(file)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(ab)
    const rows: string[] = []
    workbook.eachSheet(sheet => {
      sheet.eachRow(row => {
        rows.push((row.values as any[]).slice(1).join('\t'))
      })
    })
    return rows.join('\n').substring(0, 50000)
  }

  // Default: plain text
  return await readFileAsText(file)
}

async function uploadFileForIntelligence(file: File): Promise<any> {
  const text = await extractTextFromFile(file)
  if (!text || text.trim().length < 10) {
    throw new Error(`Could not extract readable text from ${file.name}`)
  }
  return extractIntelligenceFromText(text.substring(0, 60000))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function IngestToGraphPanel({ setGraph }: any) {
  const [ingestType, setIngestType] = useState<'text' | 'url' | 'file'>('text')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Multi-file queue state
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [queueProgress, setQueueProgress] = useState<{ done: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)
  const fileQueueRef = useRef<QueuedFile[]>([])

  // ---------------------------------------------------------------------------
  // Queue helpers
  // ---------------------------------------------------------------------------
  const addFilesToQueue = (files: FileList | File[]) => {
    const arr = Array.from(files)
    const newItems: QueuedFile[] = arr.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending',
    }))
    setFileQueue(prev => {
      const next = [...prev, ...newItems]
      fileQueueRef.current = next
      return next
    })
    setIngestType('file')
  }

  const removeFromQueue = (id: string) => {
    setFileQueue(prev => prev.filter(q => q.id !== id))
  }

  const clearQueue = () => {
    setFileQueue([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------------------------------------------------------------------------
  // Process the full queue sequentially — always reads from ref to avoid stale closure
  // ---------------------------------------------------------------------------
  const processQueue = async () => {
    if (processingRef.current) return
    const pending = fileQueueRef.current.filter(q => q.status === 'pending')
    if (pending.length === 0) return
    processingRef.current = true
    setIsProcessingQueue(true)
    setQueueProgress({ done: 0, total: pending.length })

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i]
      setFileQueue(prev => {
        const next = prev.map(q => q.id === item.id ? { ...q, status: 'processing' as QueueStatus } : q)
        fileQueueRef.current = next
        return next
      })
      try {
        const result = await uploadFileForIntelligence(item.file)
        setGraph((prev: any) => mergeGraphs(prev, result))
        setFileQueue(prev => {
          const next = prev.map(q => q.id === item.id ? { ...q, status: 'done' as QueueStatus } : q)
          fileQueueRef.current = next
          return next
        })
      } catch (err: any) {
        setFileQueue(prev => {
          const next = prev.map(q => q.id === item.id ? { ...q, status: 'error' as QueueStatus, error: err.message || 'Failed' } : q)
          fileQueueRef.current = next
          return next
        })
      }
      setQueueProgress(prev => prev ? { ...prev, done: i + 1 } : { done: i + 1, total: pending.length })
    }

    processingRef.current = false
    setIsProcessingQueue(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  // Auto-run: fire whenever new pending files arrive and queue is idle
  useEffect(() => {
    const hasPending = fileQueueRef.current.some(q => q.status === 'pending')
    if (hasPending && !processingRef.current) {
      processQueue()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileQueue.length])

  // ---------------------------------------------------------------------------
  // Text / URL ingest
  // ---------------------------------------------------------------------------
  const handleIngest = async () => {
    if (ingestType === 'file') {
      await processQueue()
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

  // ---------------------------------------------------------------------------
  // File input / drag handlers
  // ---------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files)
    }
  }

  const pendingCount = fileQueue.filter(q => q.status === 'pending').length
  const doneCount = fileQueue.filter(q => q.status === 'done').length
  const errorCount = fileQueue.filter(q => q.status === 'error').length

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
                className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all group
                  ${dragOver
                    ? 'bg-[#d4af37]/10 border-[#d4af37]/60'
                    : fileQueue.length > 0
                      ? 'bg-white/[0.03] border-[#d4af37]/20 py-4'
                      : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-[#d4af37]/30 h-36'
                  }`}
              >
                {fileQueue.length === 0 ? (
                  <>
                    <div className="p-4 rounded-full bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="text-white/40 group-hover:text-[#d4af37]/50" size={24} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Drop or Select Files
                    </p>
                    <p className="text-[9px] font-mono text-white/20 mt-1 text-center leading-relaxed">
                      Multiple files supported · PDF · DOCX · CSV · XLS · TXT · JSON · ZIP<br />
                      Images · Audio · Video · Code · Any format
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#d4af37]/60 uppercase tracking-widest">
                    <Upload size={14} />
                    <span>Drop more files to add to queue</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="*/*"
                  multiple
                />
              </div>

              {/* Queue list */}
              {fileQueue.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-white/30">
                      Queue — {fileQueue.length} file{fileQueue.length !== 1 ? 's' : ''}
                      {doneCount > 0 && ` · ${doneCount} done`}
                      {errorCount > 0 && ` · ${errorCount} failed`}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); clearQueue() }}
                      className="text-[9px] font-mono text-white/20 hover:text-red-400 uppercase tracking-widest transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {fileQueue.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                          item.status === 'done' ? 'bg-green-500/5 border-green-500/20' :
                          item.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                          item.status === 'processing' ? 'bg-[#d4af37]/10 border-[#d4af37]/30 animate-pulse' :
                          'bg-white/[0.03] border-white/5'
                        }`}
                      >
                        {/* Status icon */}
                        <div className="shrink-0">
                          {item.status === 'done' && <Check size={12} className="text-green-400" />}
                          {item.status === 'error' && <AlertCircle size={12} className="text-red-400" />}
                          {item.status === 'processing' && <Loader2 size={12} className="text-[#d4af37] animate-spin" />}
                          {item.status === 'pending' && <File size={12} className="text-white/30" />}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-white/70 truncate">{item.file.name}</p>
                          {item.status === 'error' && item.error && (
                            <p className="text-[9px] font-mono text-red-400 truncate">{item.error}</p>
                          )}
                          {item.status === 'pending' && (
                            <p className="text-[9px] font-mono text-white/20">{formatBytes(item.file.size)}</p>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0">
                          {item.status === 'done' && (
                            <span className="text-[8px] font-mono uppercase text-green-400 tracking-widest">Integrated</span>
                          )}
                          {item.status === 'processing' && (
                            <span className="text-[8px] font-mono uppercase text-[#d4af37] tracking-widest">Analyzing…</span>
                          )}
                          {item.status === 'pending' && (
                            <button
                              onClick={e => { e.stopPropagation(); removeFromQueue(item.id) }}
                              className="p-1 hover:bg-white/10 rounded-full text-white/20 hover:text-white/60 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  {isProcessingQueue && queueProgress && (
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#d4af37] transition-all duration-500"
                          style={{ width: `${(queueProgress.done / queueProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-[9px] font-mono text-white/30 text-center">
                        Processing {queueProgress.done} / {queueProgress.total}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inject button — shown for all modes */}
      <button
        onClick={handleIngest}
        disabled={
          loading ||
          isProcessingQueue ||
          (ingestType === 'file' ? pendingCount === 0 : !inputValue.trim())
        }
        className="w-full relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl bg-white text-black py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#d4af37] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        {loading || isProcessingQueue ? (
          <Loader2 className="animate-spin" size={16} />
        ) : success ? (
          <Check size={16} />
        ) : (
          <Search size={16} />
        )}
        {isProcessingQueue
          ? `Analyzing ${queueProgress?.done ?? 0}/${queueProgress?.total ?? pendingCount}…`
          : loading
            ? 'Analyzing Intel...'
            : success
              ? 'Evidence Integrated'
              : ingestType === 'file' && pendingCount > 1
                ? `Inject ${pendingCount} Files to Engine`
                : 'Inject to Engine'
        }

        {(loading || isProcessingQueue) && (
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
          <span className="text-[10px] font-bold uppercase text-[#d4af37] tracking-wider">
            Lattice update complete
            {doneCount > 1 && ` · ${doneCount} files integrated`}
          </span>
        </motion.div>
      )}
    </div>
  )
}
