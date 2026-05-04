/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { NetworkMap } from './components/NetworkMap';
import { NarrativeSidebar } from './components/NarrativeSidebar';
import { SearchOverlay } from './components/SearchOverlay';
import { deepSearchEntity, extractIntelligenceFromCsv, huntZipIntelligence } from './services/geminiService.ts';
import { searchDriveForIntelligence, downloadDriveFile } from './services/driveService.ts';
import { SearchResult, AppState } from './types';
import { Search, RotateCcw, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { analyzeZipFile, getZipFileContent } from './services/zipService';

export default function App() {
  const [state, setState] = useState<AppState & { driveToken: string | null }>({
    isSearching: false,
    error: null,
    results: null,
    history: [],
    driveToken: localStorage.getItem('google_drive_token')
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, isSearching: true, error: null }));
    try {
      // 1. Initial Web Search
      let finalResults = await deepSearchEntity(query);

      // 2. Automated Drive Intelligence (If token exists)
      if (state.driveToken) {
        const driveFiles = await searchDriveForIntelligence(query, state.driveToken);
        if (driveFiles.length > 0) {
          console.log(`Found ${driveFiles.length} intelligence sources in Drive.`);
          
          // Pick the most promising file (e.g. first CSV or ZIP)
          const sourceFile = driveFiles[0];
          const blob = await downloadDriveFile(sourceFile.id, state.driveToken);
          const file = new File([blob], sourceFile.name, { type: sourceFile.mimeType });

          let driveData: SearchResult | null = null;
          if (file.name.endsWith('.csv')) {
             const text = await file.text();
             driveData = await extractIntelligenceFromCsv(text);
          } else if (file.name.endsWith('.zip')) {
             const metadata = await analyzeZipFile(file);
             const samples: { [path: string]: string } = {};
             for (const path of metadata.interestingFiles.slice(0, 3)) {
               const content = await getZipFileContent(file, path);
               if (content) samples[path] = content;
             }
             driveData = await huntZipIntelligence(file.name, metadata.fileTree, samples);
          }

          if (driveData) {
            // Merge results
            finalResults = {
              ...finalResults,
              nodes: [...finalResults.nodes, ...driveData.nodes.filter(n => !finalResults.nodes.find(fn => fn.id === n.id))],
              links: [...finalResults.links, ...driveData.links],
              narrative: `${finalResults.narrative}\n\n---\n\n### Local Intelligence Addendum (Google Drive Source: ${sourceFile.name})\n${driveData.narrative}`
            };
          }
        }
      }

      setState(prev => ({
        ...prev,
        isSearching: false,
        results: finalResults,
        history: [query, ...prev.history].slice(0, 5)
      }));
      setSidebarOpen(true);
    } catch (err: any) {
      console.error(err);
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: "Deep scan encounterd an issue. Retrying may resolve it."
      }));
    }
  }, [state.driveToken]);

  const handleCsvUpload = useCallback(async (csvData: string) => {
    setState(prev => ({ ...prev, isSearching: true, error: null }));
    try {
      const data = await extractIntelligenceFromCsv(csvData);
      setState(prev => ({
        ...prev,
        isSearching: false,
        results: data,
      }));
      setSidebarOpen(true);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: "CSV intelligence extraction failed. Ensure the file is correctly formatted."
      }));
    }
  }, []);

  const handleZipUpload = useCallback(async (zipName: string, fileTree: string[], samples: { [path: string]: string }) => {
    setState(prev => ({ ...prev, isSearching: true, error: null }));
    try {
      const data = await huntZipIntelligence(zipName, fileTree, samples);
      setState(prev => ({
        ...prev,
        isSearching: false,
        results: data,
      }));
      setSidebarOpen(true);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: "ZIP intelligence extraction failed. The archive might be corrupt or unreadable."
      }));
    }
  }, []);

  const reset = () => {
    setState({
      isSearching: false,
      error: null,
      results: null,
      history: state.history,
      driveToken: state.driveToken
    });
    setSidebarOpen(false);
  };

  return (
    <div className="relative w-screen h-screen bg-[#050505] text-white selection:bg-green-500 selection:text-black">
      {/* Search Header (Visible when results exist) */}
      <AnimatePresence>
        {state.results && !state.isSearching && (
          <motion.header 
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className="absolute top-0 left-0 w-full h-16 border-b border-white/10 flex items-center justify-between px-6 z-20 bg-black/50 backdrop-blur-md"
          >
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
                <Search size={16} className="text-green-500" />
                Nexus <span className="text-white/40">Explorer</span>
              </h1>
              <div className="h-4 w-[1px] bg-white/20 mx-2" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40 uppercase">Analyzing:</span>
                <span className="text-xs font-mono text-green-500">{state.results.centralNode}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="text-[10px] font-mono uppercase tracking-widest text-white/60 hover:text-white transition-colors"
              >
                [View Narrative]
              </button>
              <button 
                onClick={reset}
                className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
                title="New Search"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className="w-full h-full">
        {state.results ? (
           <NetworkMap 
             data={state.results} 
             onNodeClick={(node) => {
               console.log('Clicked node:', node);
               setSidebarOpen(true);
             }}
           />
        ) : (
          !state.isSearching && <div className="w-full h-full bg-[#050505] flex items-center justify-center">
             <div className="text-center opacity-20 scale-150 rotate-3 select-none pointer-events-none">
                <h1 className="text-9xl font-serif italic text-white">Investigation</h1>
                <p className="font-mono uppercase tracking-[2em] ml-[2em]">Pending Initiative</p>
             </div>
          </div>
        )}
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {(!state.results || state.isSearching) && (
          <SearchOverlay 
            onSearch={handleSearch} 
            onCsvUpload={handleCsvUpload} 
            onZipUpload={handleZipUpload}
            isSearching={state.isSearching} 
            driveToken={state.driveToken}
            onDriveAuth={(token) => {
              localStorage.setItem('google_drive_token', token);
              setState(prev => ({ ...prev, driveToken: token }));
            }}
          />
        )}

        {state.error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-red-950 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 shadow-2xl"
          >
            <AlertTriangle className="text-red-500" size={20} />
            <div className="flex-1">
              <p className="text-xs text-red-200">{state.error}</p>
            </div>
            <button onClick={reset} className="text-[10px] font-mono uppercase text-red-400 hover:text-red-100">[Retry]</button>
          </motion.div>
        )}

        {sidebarOpen && state.results && (
          <NarrativeSidebar 
            data={state.results} 
            onClose={() => setSidebarOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Grid Pattern Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>
    </div>
  );
}
