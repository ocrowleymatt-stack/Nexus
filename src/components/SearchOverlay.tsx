/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Cpu, Globe, Database, FileUp, UploadCloud, Archive, Box, CheckCircle, ShieldCheck } from 'lucide-react';
import Papa from 'papaparse';
import { analyzeZipFile, getZipFileContent } from '../services/zipService';
import { NexusGuide } from './NexusGuide';

interface SearchOverlayProps {
  onSearch: (query: string) => void;
  onCsvUpload: (csvData: string) => void;
  onZipUpload: (zipName: string, fileTree: string[], samples: { [path: string]: string }) => void;
  isSearching: boolean;
  error: string | null;
  driveToken: string | null;
  onDriveAuth: (token: string) => void;
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    try {
      return await file.text();
    } catch (error) {
      console.warn('file.text() failed; falling back to FileReader', error);
    }
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(reader.error?.message || 'Could not read selected file.'));
    reader.readAsText(file);
  });
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ 
  onSearch, 
  onCsvUpload, 
  onZipUpload, 
  isSearching, 
  error,
  driveToken, 
  onDriveAuth 
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'guide' | 'search' | 'csv' | 'zip' | 'drive'>('guide');
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (query.trim() && !isSearching) {
      onSearch(query.trim());
    }
  };

  const handleAuthorize = () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Google Client ID not configured in environment.');
      return;
    }

    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(scope)}`;
    
    const popup = window.open(authUrl, '_blank', 'width=600,height=600');
    
    const interval = setInterval(() => {
      try {
        if (popup?.location.hash) {
          const params = new URLSearchParams(popup.location.hash.substring(1));
          const token = params.get('access_token');
          if (token) {
            onDriveAuth(token);
            clearInterval(interval);
            popup.close();
            setMode('search');
          }
        }
      } catch (e) {
        // Cross-origin might throw until the popup redirects back to redirectUri.
      }
      if (popup?.closed) clearInterval(interval);
    }, 500);
  };

  const parseCsvFile = async (file: File) => {
    const csvText = await readFileAsText(file);

    if (!csvText.trim()) {
      throw new Error('CSV file is empty or could not be read by the browser.');
    }

    const results = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      transformHeader: (header) => String(header || '').trim()
    });

    if (results.errors.length > 0) {
      const fatalErrors = results.errors.filter((csvError) => csvError.code !== 'TooFewFields');
      if (fatalErrors.length > 0) {
        const firstError = fatalErrors[0];
        throw new Error(`CSV parse failed near row ${firstError.row ?? 'unknown'}: ${firstError.message}`);
      }
    }

    const rows = Array.isArray(results.data) ? results.data : [];
    const populatedRows = rows.filter((row) => Object.values(row || {}).some((value) => String(value ?? '').trim() !== ''));

    if (populatedRows.length === 0) {
      throw new Error('CSV parsed successfully but contained no usable rows.');
    }

    const dataToIngest = populatedRows.length > 20000 ? populatedRows.slice(0, 20000) : populatedRows;
    onCsvUpload(JSON.stringify(dataToIngest));
  };

  const handleFile = useCallback(async (file: File) => {
    setLocalError(null);

    try {
      const fileName = String(file.name || '').toLowerCase();
      const fileType = String(file.type || '').toLowerCase();

      if (fileName.endsWith('.csv') || fileType.includes('csv') || fileType.includes('text/plain')) {
        await parseCsvFile(file);
      } else if (fileName.endsWith('.zip') || fileType.includes('zip')) {
        const metadata = await analyzeZipFile(file);
        const samples: { [path: string]: string } = {};
        
        for (const path of metadata.interestingFiles.slice(0, 3)) {
          const content = await getZipFileContent(file, path);
          if (content) samples[path] = content;
        }

        onZipUpload(file.name, metadata.fileTree, samples);
      } else {
        throw new Error(`Unsupported file type: ${file.name || file.type || 'unknown'}. Upload a .csv or .zip file.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed.';
      setLocalError(message);
    }
  }, [onCsvUpload, onZipUpload]);

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
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Cpu className="text-green-500" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Nexus Narrative Explorer</h1>
                <p className="text-xs font-mono text-white/30 uppercase tracking-widest mt-1">Grounded Deep Search v1.0.5</p>
              </div>
            </div>
            
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 overflow-x-auto max-w-[300px] md:max-w-none">
              {(['guide', 'search', 'csv', 'zip', 'drive'] as const).map((tab) => (
                <button 
                  key={tab}
                  onClick={() => { setLocalError(null); setMode(tab); }}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap ${mode === tab ? 'bg-green-500 text-black' : 'text-white/40 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

            <AnimatePresence mode="wait">
              {displayError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-mono"
                >
                  <Database size={16} />
                  <span>Error: {displayError}</span>
                </motion.div>
              )}
              {mode === 'guide' ? (
                <motion.div
                  key="guide-mode"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <NexusGuide />
                  <div className="mt-8 flex justify-center">
                    <button 
                      onClick={() => setMode('search')}
                      className="px-8 py-3 bg-green-500 text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                      Enter Investigative Core
                    </button>
                  </div>
                </motion.div>
              ) : mode === 'search' ? (
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-5 text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 transition-all font-sans pr-16"
                    disabled={isSearching}
                  />
                  <button 
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-green-500 text-black rounded-lg hover:bg-green-400 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:shadow-none"
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
                      className="text-[10px] font-mono text-white/40 hover:text-green-500 transition-colors uppercase"
                    >
                      [{ex}]
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : mode === 'csv' || mode === 'zip' ? (
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
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all ${isDragging ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className={`p-4 rounded-full mb-4 transition-all ${isDragging ? 'bg-green-500 text-black' : 'bg-white/5 text-white/20'}`}>
                    {mode === 'csv' ? <UploadCloud size={32} /> : <Archive size={32} />}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {mode === 'csv' ? 'Intelligence Data Ingestion' : 'Forensic ZIP Extraction'}
                  </h3>
                  <p className="text-xs text-white/40 mb-6 font-mono uppercase tracking-tight">
                    Drop .{mode.toUpperCase()} file to begin deep analysis
                  </p>
                  
                  <label className="cursor-pointer px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono uppercase tracking-widest transition-all">
                    Selective Upload
                    <input 
                      type="file" 
                      accept={mode === 'csv' ? '.csv,text/csv,text/plain' : '.zip,application/zip,application/x-zip-compressed'} 
                      className="hidden" 
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFile(selectedFile);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                
                <div className="mt-8 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 truncate">
                    <FileUp size={12} />
                    <span>
                      {mode === 'csv' 
                        ? 'Gemini Smart Extraction: Maps nodes & relationships automatically from tabular data'
                        : 'Metadata Hunter: Scans file structures for PII, social graphs, and digital footprints'}
                    </span>
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
                <div className={`p-4 rounded-full w-fit mx-auto mb-4 ${driveToken ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {driveToken ? <ShieldCheck size={32} /> : <Box size={32} />}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">
                  {driveToken ? 'Google Drive Connected' : 'Google Drive Integration'}
                </h3>
                <p className="text-xs text-white/40 mb-8 font-mono uppercase px-12 leading-relaxed">
                  {driveToken 
                    ? 'Deep search will now automatically crawl your connected drive for matching intelligence files.'
                    : 'Direct connection to Google Drive for automated intelligence harvesting and metadata hunting.'}
                </p>
                
                {driveToken ? (
                   <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-[10px] font-mono uppercase text-green-500">Automated Scan Active</span>
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
                <div className="flex items-center gap-4 text-xs font-mono text-green-500 uppercase tracking-widest">
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
                      <ProgressStep icon={<FileUp size={14} />} text="Parsing file structure and source metadata..." active />
                      <ProgressStep icon={<Cpu size={14} />} text="Extracting entity vectors and link probability..." active />
                    </>
                  )}
                  <ProgressStep icon={<Cpu size={14} />} text="Synthesising narratives via Gemini..." active />
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
  <div className={`flex items-center gap-3 p-3 rounded-lg border ${active ? 'bg-green-500/5 border-green-500/10 text-green-500/70' : 'bg-white/5 border-white/5 text-white/30'}`}>
    {icon}
    <span className="text-[10px] font-mono uppercase tracking-tighter">{text}</span>
    {active && <Loader2 className="ml-auto animate-spin" size={12} />}
  </div>
);
