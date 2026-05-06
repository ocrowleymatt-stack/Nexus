/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Cpu, Globe, Database, FileUp, UploadCloud, Archive, Box, CheckCircle, ShieldCheck, Shield, X, File, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { analyzeZipFile, getZipFileContent } from '../services/zipService';
import { loginWithGoogleForDrive } from '../lib/firebase';

interface SearchOverlayProps {
  onSearch: (query: string) => void;
  onCsvUpload: (csvData: string) => void;
  onZipUpload: (zipName: string, fileTree: string[], samples: { [path: string]: string }) => void;
  onTextUpload?: (textData: string) => void;
  onClose?: () => void;
  isSearching: boolean;
  error: string | null;
  driveToken: string | null;
  onDriveAuth: (token: string) => void;
}

// ---------------------------------------------------------------------------
// Multi-file queue types
// ---------------------------------------------------------------------------
type QueueStatus = 'pending' | 'processing' | 'done' | 'error';
interface QueuedFile { id: string; file: File; status: QueueStatus; error?: string; }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ 
  onSearch, 
  onCsvUpload, 
  onZipUpload, 
  onTextUpload,
  onClose,
  isSearching, 
  error,
  driveToken, 
  onDriveAuth 
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'file' | 'drive'>('search');
  const [isDragging, setIsDragging] = useState(false);

  // Multi-file queue
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSearching) {
      onSearch(query.trim());
    }
  };

  // Google Drive auth via Firebase — reuses the existing Firebase OAuth client,
  // no separate VITE_GOOGLE_CLIENT_ID required.
  const handleAuthorize = async () => {
    try {
      const token = await loginWithGoogleForDrive();
      onDriveAuth(token);
      setMode('search');
    } catch (err: any) {
      console.error('Drive auth failed:', err);
      alert(`Google Drive sign-in failed: ${err?.message ?? 'Unknown error'}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Queue helpers
  // ---------------------------------------------------------------------------
  const addFilesToQueue = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: QueuedFile[] = arr.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending',
    }));
    setFileQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = (id: string) => setFileQueue(prev => prev.filter(q => q.id !== id));
  const clearQueue = () => { setFileQueue([]); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const processQueue = async () => {
    const pending = fileQueue.filter(q => q.status === 'pending');
    if (pending.length === 0) return;
    setIsProcessingQueue(true);
    setQueueProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
      try {
        await handleFile(item.file);
        setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
      } catch (err: any) {
        setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message || 'Failed' } : q));
      }
      setQueueProgress({ done: i + 1, total: pending.length });
    }
    setIsProcessingQueue(false);
    setQueueProgress(null);
  };

  const handleFile = useCallback(async (file: File) => {
    console.log(`[CLIENT] Handling file upload: ${file.name} (${file.size} bytes)`);
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          // Robust handling: slice data if it's massive to avoid string length limits
          const dataToIngest = results.data.length > 5000 ? results.data.slice(0, 5000) : results.data;
          
          // Convert back to CSV string
          const csvString = Papa.unparse(dataToIngest);
          onCsvUpload(csvString);
        },
        header: true,
        skipEmptyLines: true
      });
    } else if (file.name.endsWith('.zip')) {
      const metadata = await analyzeZipFile(file);
      const samples: { [path: string]: string } = {};
      
      // Grab top 3 interesting files for intelligence sampling
      for (const path of metadata.interestingFiles.slice(0, 3)) {
        const content = await getZipFileContent(file, path);
        if (content) samples[path] = content;
      }

      onZipUpload(file.name, metadata.fileTree, samples);
    } else {
      try {
        const text = await file.text();
        const sliced = text.length > 80000 ? text.slice(0, 80000) : text;
        if (onTextUpload) onTextUpload(sliced);
      } catch (e) {
        console.error("Could not parse file as text", e);
      }
    }
  }, [onCsvUpload, onZipUpload, onTextUpload]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const pendingCount = fileQueue.filter(q => q.status === 'pending').length;
  const doneCount = fileQueue.filter(q => q.status === 'done').length;
  const errorCount = fileQueue.filter(q => q.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#d4af37]/10 rounded-lg">
                <Shield className="text-[#d4af37]" size={24} />
              </div>
              <div>
                <div className="flex flex-col -mb-1">
                  <span className="text-[8px] font-mono tracking-[0.4em] text-[#d4af37]/40 uppercase">O'CROWLEY</span>
                  <h1 className="text-2xl font-serif italic font-black text-white tracking-tighter">Nexus</h1>
                </div>
                <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] mt-0.5">Secure Grounded Protocol // v1.2.0-ADR</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 overflow-x-auto max-w-[200px] md:max-w-none">
                  <button 
                    onClick={() => setMode('search')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap ${mode === 'search' ? 'bg-[#d4af37] text-black font-bold' : 'text-white/40 hover:text-white'}`}
                  >
                    Investigate
                  </button>
                  <button 
                    onClick={() => setMode('file')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap ${mode === 'file' ? 'bg-[#d4af37] text-black font-bold' : 'text-white/40 hover:text-white'}`}
                  >
                    Dossier
                  </button>
                  <button 
                    onClick={() => setMode('drive')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap ${mode === 'drive' ? 'bg-[#d4af37] text-black font-bold' : 'text-white/40 hover:text-white'}`}
                  >
                    Vault
                  </button>
              </div>

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                  title="Close and Enter Workspace"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-mono"
                >
                  <Database size={16} />
                  <span>Error: {error}</span>
                </motion.div>
              )}
              {mode === 'search' ? (
              <motion.div
                key="search-mode"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <form onSubmit={handleSubmit} className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter target node (Person, Org, Alias...)"
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-6 py-6 text-xl text-white placeholder:text-white/10 focus:outline-none focus:border-[#d4af37]/40 transition-all font-serif italic pr-16"
                    disabled={isSearching}
                  />
                  <button 
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-[#d4af37] text-black rounded-lg hover:bg-[#eab308] disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:shadow-none"
                  >
                    {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                  </button>
                </form>

                <div className="mt-8 flex flex-wrap gap-4">
                  <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">Example Nodes:</span>
                  {['Satya Nadella', 'NVIDIA Research', 'Lunar Gateway', 'OpenSource Security'].map((ex) => (
                    <button 
                      key={ex}
                      onClick={() => setQuery(ex)}
                      className="text-[10px] font-mono text-white/40 hover:text-[#d4af37] transition-colors uppercase"
                    >
                      [{ex}]
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : mode === 'file' ? (
              <motion.div
                key="file-mode"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Drop zone */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isDragging ? 'border-[#d4af37] bg-[#d4af37]/10 p-10' :
                    fileQueue.length > 0 ? 'border-[#d4af37]/20 bg-white/5 p-4' :
                    'border-white/10 bg-white/5 hover:border-white/20 p-12'
                  }`}
                >
                  {fileQueue.length === 0 ? (
                    <>
                      <div className={`p-4 rounded-full mb-4 transition-all ${isDragging ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-white/20'}`}>
                        <UploadCloud size={32} />
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">Intelligence Data Ingestion</h3>
                      <p className="text-xs text-white/40 mb-4 font-mono uppercase tracking-tight">Drop files or click to select — multiple files supported</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#d4af37]/50 uppercase tracking-widest">
                      <UploadCloud size={14} />
                      <span>Drop more files to add to queue</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => e.target.files && e.target.files.length > 0 && addFilesToQueue(e.target.files)}
                  />
                </div>

                {/* Queue list */}
                {fileQueue.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/30">
                        Queue — {fileQueue.length} file{fileQueue.length !== 1 ? 's' : ''}
                        {doneCount > 0 && ` · ${doneCount} done`}
                        {errorCount > 0 && ` · ${errorCount} failed`}
                      </span>
                      <button onClick={clearQueue} className="text-[9px] font-mono text-white/20 hover:text-red-400 uppercase tracking-widest transition-colors">Clear all</button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {fileQueue.map(item => (
                        <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                          item.status === 'done' ? 'bg-green-500/5 border-green-500/20' :
                          item.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                          item.status === 'processing' ? 'bg-[#d4af37]/10 border-[#d4af37]/30 animate-pulse' :
                          'bg-white/[0.03] border-white/5'
                        }`}>
                          <div className="shrink-0">
                            {item.status === 'done' && <Check size={12} className="text-green-400" />}
                            {item.status === 'error' && <AlertCircle size={12} className="text-red-400" />}
                            {item.status === 'processing' && <Loader2 size={12} className="text-[#d4af37] animate-spin" />}
                            {item.status === 'pending' && <File size={12} className="text-white/30" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono text-white/70 truncate">{item.file.name}</p>
                            {item.status === 'error' && <p className="text-[9px] font-mono text-red-400 truncate">{item.error}</p>}
                            {item.status === 'pending' && <p className="text-[9px] font-mono text-white/20">{formatBytes(item.file.size)}</p>}
                          </div>
                          <div className="shrink-0">
                            {item.status === 'done' && <span className="text-[8px] font-mono uppercase text-green-400 tracking-widest">Done</span>}
                            {item.status === 'processing' && <span className="text-[8px] font-mono uppercase text-[#d4af37] tracking-widest">Analyzing…</span>}
                            {item.status === 'pending' && (
                              <button onClick={() => removeFromQueue(item.id)} className="p-1 hover:bg-white/10 rounded-full text-white/20 hover:text-white/60 transition-colors">
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {isProcessingQueue && queueProgress && (
                      <div className="space-y-1">
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#d4af37] transition-all duration-500" style={{ width: `${(queueProgress.done / queueProgress.total) * 100}%` }} />
                        </div>
                        <p className="text-[9px] font-mono text-white/30 text-center">Processing {queueProgress.done} / {queueProgress.total}</p>
                      </div>
                    )}
                    {/* Process queue button */}
                    {pendingCount > 0 && !isProcessingQueue && (
                      <button
                        onClick={processQueue}
                        disabled={isSearching}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4af37] text-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#eab308] transition-all disabled:opacity-50"
                      >
                        <UploadCloud size={14} />
                        Inject {pendingCount} File{pendingCount !== 1 ? 's' : ''} to Engine
                      </button>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/30">
                  <FileUp size={12} />
                  <span>Gemini Smart Extraction: Maps nodes &amp; relationships automatically from unstructured data types.</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="box-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-12 border border-white/5 rounded-2xl bg-white/5 text-center"
              >
                <div className={`p-4 rounded-full w-fit mx-auto mb-4 ${driveToken ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'bg-blue-500/10 text-blue-500'}`}>
                  {driveToken ? <ShieldCheck size={32} /> : <Box size={32} />}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">
                  {driveToken ? 'Secure Repository Connected' : 'Google Drive Integration'}
                </h3>
                <p className="text-xs text-white/40 mb-8 font-mono uppercase px-12 leading-relaxed">
                  {driveToken 
                    ? "Deep search will now automatically crawl your connected drive for matching intelligence files."
                    : "Direct connection to Google Drive for automated intelligence harvesting and metadata hunting."}
                </p>
                
                {driveToken ? (
                   <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-lg">
                        <CheckCircle size={14} className="text-[#d4af37]" />
                        <span className="text-[10px] font-mono uppercase text-[#d4af37]">Automated Scan Active</span>
                      </div>
                      <button 
                        onClick={() => setMode('search')}
                        className="text-[10px] font-mono uppercase text-white/30 hover:text-white transition-colors"
                      >
                        [Return to Search]
                      </button>
                   </div>
                ) : (
                  <button 
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono uppercase tracking-widest transition-all shadow-lg"
                    onClick={handleAuthorize}
                  >
                    Authorize Drive Access
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSearching && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mt-8 space-y-4"
              >
                <div className="flex items-center gap-4 text-xs font-mono text-[#d4af37] uppercase tracking-widest">
                  <span className="flex-1">{mode === 'search' ? 'Deep Research in Progress' : 'Smart Extraction Active'}</span>
                  <span className="animate-pulse">Active</span>
                </div>
                
                <div className="space-y-3">
                  {mode === 'search' ? (
                    <>
                      <ProgressStep icon={<Globe size={14} />} text="Scanning Google Search index for entity ties..." active />
                      <ProgressStep icon={<Database size={14} />} text="Extracting relational patterns and public records..." active />
                    </>
                  ) : (
                    <>
                      <ProgressStep icon={<FileUp size={14} />} text="Parsing CSV structure and column metadata..." active />
                      <ProgressStep icon={<Cpu size={14} />} text="Extracting entity vectors and link probability..." active />
                    </>
                  )}
                  <ProgressStep icon={<Cpu size={14} />} text="Synthesizing narratives via Gemini 3.1..." active />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="bg-white/5 px-8 py-3 flex justify-between items-center text-[9px] font-mono text-white/20 uppercase tracking-widest">
           <span>{mode === 'search' ? 'Secure Grounded Protocol' : 'Intelligence Processing Unit'}</span>
           <span>EST: {new Date().toLocaleTimeString()}</span>
        </div>
      </motion.div>
    </div>
  );
};

const ProgressStep = ({ icon, text, active }: { icon: React.ReactNode, text: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg border ${active ? 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]/70' : 'bg-white/5 border-white/5 text-white/30'}`}>
    {icon}
    <span className="text-[10px] font-mono uppercase tracking-tighter">{text}</span>
    {active && <Loader2 className="ml-auto animate-spin" size={12} />}
  </div>
);
