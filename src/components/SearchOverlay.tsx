/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Cpu, Globe, Database, FileUp, UploadCloud, Archive, Box, CheckCircle, ShieldCheck, Shield, X } from 'lucide-react';
import Papa from 'papaparse';
import { analyzeZipFile, getZipFileContent } from '../services/zipService';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSearching) {
      onSearch(query.trim());
    }
  };

  // Simple Google OAuth Popup
  const handleAuthorize = () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("Google Client ID not configured in environment.");
      return;
    }

    const scope = "https://www.googleapis.com/auth/drive.readonly";
    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    
    const popup = window.open(authUrl, "_blank", "width=600,height=600");
    
    // Listen for the token in the fragment
    const interval = setInterval(() => {
      try {
        if (popup?.location.hash) {
          const params = new URLSearchParams(popup.location.hash.substring(1));
          const token = params.get("access_token");
          if (token) {
            onDriveAuth(token);
            clearInterval(interval);
            popup.close();
            setMode('search');
          }
        }
      } catch (e) {
        // Cross-origin might throw until the popup redirects back to redirectUri
      }
      if (popup?.closed) clearInterval(interval);
    }, 500);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

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
                  <h1 className="text-2xl font-display font-black text-white tracking-tighter">Nexus</h1>
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
                  <button 
                    onClick={() => setMode('nexus-remote' as any)}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap ${mode === 'nexus-remote' as any ? 'bg-[#d4af37] text-black font-bold' : 'text-[#d4af37]/40 hover:text-[#d4af37]'}`}
                  >
                    Pulse
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
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-6 py-6 text-xl text-white placeholder:text-white/10 focus:outline-none focus:border-[#d4af37]/40 transition-all font-display font-black pr-16"
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

                <div className="mt-8 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider mr-2">Example Targets:</span>
                    {['Satya Nadella', 'Lazarus Group', 'Operation Cookie Monster', 'Silicon Valley Bank Failure'].map((ex) => (
                      <button 
                        key={ex}
                        onClick={() => setQuery(ex)}
                        className="px-3 py-1 bg-white/5 hover:bg-[#d4af37]/20 border border-white/5 hover:border-[#d4af37]/30 rounded-full text-[9px] font-mono text-white/40 hover:text-[#d4af37] transition-all uppercase"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-white/10 italic">
                    Tip: Use broad entity names. Nexus will use Gemini 2.5 with Google Search grounding to map real-time relationships.
                  </p>
                </div>
              </motion.div>
            ) : mode === 'file' ? (
              <motion.div
                key="file-mode"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all ${isDragging ? 'border-[#d4af37] bg-[#d4af37]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className={`p-4 rounded-full mb-4 transition-all ${isDragging ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-white/20'}`}>
                    <UploadCloud size={32} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Intelligence Data Ingestion
                  </h3>
                  <p className="text-xs text-white/40 mb-6 font-mono uppercase tracking-tight">
                    Drop any file to begin deep analysis
                  </p>
                  
                  <label className="cursor-pointer px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono uppercase tracking-widest transition-all">
                    Selective Upload
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </div>
                
                <div className="mt-8 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 truncate">
                    <FileUp size={12} />
                    <span>
                      Gemini Smart Extraction: Maps nodes & relationships automatically from unstructured data types.
                    </span>
                  </div>
                </div>
              </motion.div>
             ) : mode === ('nexus-remote' as any) ? (
                <motion.div 
                  key="remote-mode"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-12 border border-[#d4af37]/20 rounded-2xl bg-[#d4af37]/5 text-left"
                >
                  <div className="flex items-start gap-8">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 rounded-full bg-[#d4af37]/10 text-[#d4af37]">
                          <Globe size={32} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white font-display uppercase tracking-widest">
                            Nexus Control Protocol
                          </h3>
                          <p className="text-[10px] font-mono text-[#d4af37]/60 uppercase">Remote handshake: Active</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <p className="text-[10px] text-white/40 font-mono uppercase leading-relaxed max-w-md">
                          Use these specifications to link your Control Centre at <span className="text-[#d4af37]">nexus.ocrowley.com</span>. 
                          This app functions as a high-fidelity intelligence visualizer and processing unit.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-bold text-white/60 uppercase">API Endpoint (Deep Search)</span>
                              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[7px] font-bold rounded">CORS_OK</span>
                            </div>
                            <code className="text-[10px] font-mono text-[#d4af37] block break-all">
                              {window.location.origin}/api/ai/deep-search
                            </code>
                            <p className="text-[8px] text-white/20 mt-1 font-mono uppercase tracking-tighter">Method: POST // Body: {"{ \"entityName\": \"...\" }"}</p>
                          </div>
                          
                          <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                             <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-bold text-white/60 uppercase">Browser Hook (PostMessage)</span>
                            </div>
                            <code className="text-[9px] font-mono text-blue-400 block break-all">
                              visualizer.postMessage({'{ command: "INGEST_ENTITY", payload: { query: "Target" } }'}, "*")
                            </code>
                            <p className="text-[8px] text-white/20 mt-1 font-mono uppercase tracking-tighter">Commands: INGEST_ENTITY, EXPAND_GRAPH, SET_MINIMAL, SENSEMAKING</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-64 space-y-4">
                      <div className="p-6 bg-black/60 border border-[#d4af37]/10 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-[#d4af37] uppercase mb-4 tracking-widest">Visualizer URL</h4>
                        <div className="flex flex-col gap-3">
                          <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-4 text-[9px] font-mono text-white/60 break-all select-all">
                            {window.location.href}
                          </div>
                          <p className="text-[8px] font-mono text-white/20 uppercase text-center mt-2 italic">
                            Embed this in your Control Centre graph tab for zero-clutter visual sync.
                          </p>
                        </div>
                      </div>
                      <div className="text-[9px] font-mono text-white/10 text-center uppercase tracking-tighter">
                        Nexus Core Pulse // Ready for integration
                      </div>
                    </div>
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
           <div className="flex gap-4">
             <span>{mode === 'search' ? 'Secure Grounded Protocol' : 'Intelligence Processing Unit'}</span>
             <span className="text-[#d4af37]/40 hover:text-[#d4af37] cursor-help" title="Endpoints: /api/ai/deep-search, /ingest, /api/github">API ACCESS: ENABLED</span>
           </div>
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
