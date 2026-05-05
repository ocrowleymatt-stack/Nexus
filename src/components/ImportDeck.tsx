
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  Database, 
  Facebook, 
  Search, 
  Archive, 
  ShieldAlert, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  LayoutGrid,
  Code,
  Heart,
  Camera,
  MessageSquare,
  Globe,
  CreditCard
} from 'lucide-react';
import { inspectZip } from '../lib/importers/zipInspector';
import { processFacebookExport } from '../lib/importers/facebookExport';
import { processGoogleTakeout } from '../lib/importers/googleTakeout';
import { processAppleHealth } from '../lib/importers/appleHealth';
import { processWhatsAppExport } from '../lib/importers/whatsapp';
import { processPhotosMetadata } from '../lib/importers/photosMetadata';
import { processBrowserHistory } from '../lib/importers/browserHistory';
import { processFinancialCsv } from '../lib/importers/financialCsv';
import { processGenericCsv } from '../lib/importers/genericCsv';
import { NexusGraph } from '../types/graph';

interface ImportDeckProps {
  onImportComplete: (graph: NexusGraph) => void;
  onClose: () => void;
}

type Tab = 'takeout' | 'facebook' | 'apple-health' | 'photos' | 'whatsapp' | 'browser' | 'financial' | 'breadcrumb-zip' | 'csv' | 'inspector';

export default function ImportDeck({ onImportComplete, onClose }: ImportDeckProps) {
  const [activeTab, setActiveTab] = useState<Tab>('takeout');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [previewGraph, setPreviewGraph] = useState<NexusGraph | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[IMPORT_LOG] ${msg}`);
    setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    addLog(`File selected: ${selected?.name || "none"} (${selected?.type || "unknown type"})`);
    if (selected) {
      setFile(selected);
      setPreviewGraph(null);
      setStats(null);
      setWarnings([]);
    }
  };

  const runImport = async () => {
    if (!file) {
      addLog("WARNING: No file selected");
      return;
    }
    addLog(`STARTING IMPORT: ${file.name} | TAB: ${activeTab}`);
    setIsProcessing(true);
    try {
      let builder;
      
      if (activeTab === 'apple-health') {
        addLog("Parsing Apple Health XML...");
        builder = await processAppleHealth(file);
      } else if (activeTab === 'whatsapp') {
        addLog("Parsing WhatsApp text export...");
        builder = await processWhatsAppExport(file);
      } else if (activeTab === 'browser') {
        addLog("Parsing Browser History JSON/CSV...");
        builder = await processBrowserHistory(file);
      } else if (activeTab === 'financial') {
        addLog("Parsing Financial CSV (Monzo/Starling/etc)...");
        builder = await processFinancialCsv(file);
      } else if (activeTab === 'csv') {
        addLog("Parsing Generic CSV/TSV Loader...");
        builder = await processGenericCsv(file);
      } else {
        addLog("Opening ZIP archive...");
        const zipNodes = await inspectZip(file);
        const paths = zipNodes.map(n => n.path);
        addLog(`ZIP metadata loaded. Entries: ${paths.length}`);
        
        if (activeTab === 'facebook') {
          addLog("Running Facebook Export extractor...");
          builder = await processFacebookExport(file, paths);
        } else if (activeTab === 'takeout') {
          addLog("Running Google Takeout extractor...");
          builder = await processGoogleTakeout(file, paths);
        } else if (activeTab === 'photos') {
          addLog("Running Photos/EXIF extractor...");
          builder = await processPhotosMetadata(file, paths);
        } else if (activeTab === 'breadcrumb-zip') {
          addLog("Running Breadcrumb Takeout extractor...");
          builder = await processGoogleTakeout(file, paths);
        }

        setStats(prev => ({ ...(prev || {}), filesDetected: paths.length, paths }));
      }

      if (builder) {
        const graph = builder.getGraph();
        addLog(`SUCCESS: Extracted ${builder.getNodeCount()} nodes and ${builder.getLinkCount()} links.`);
        if (builder.getNodeCount() === 0) {
          addLog("WARNING: Zero nodes extracted. Check if file matches expected structure.");
        }
        setPreviewGraph(graph);
        setStats(prev => ({
          ...(prev || {}),
          nodes: builder.getNodeCount(),
          links: builder.getLinkCount()
        }));
      } else {
        addLog("ERROR: Builder not initialized.");
        setWarnings(["Exporter failed to initialize logic for this tab."]);
      }
    } catch (err) {
      addLog(`CRITICAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
      setWarnings([`Import failed: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-[#050505]/95 backdrop-blur-2xl"
    >
      <div className="w-full max-w-6xl h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center border border-[#d4af37]/20">
              <Database size={20} className="text-[#d4af37]" />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-white leading-none">NexusPlexus Breadcrumb Injection</h2>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">Multi-Source Forensic Gathering Agent // v2.0-STABLE</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50">
            <LayoutGrid size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-72 border-r border-white/5 bg-black/20 flex flex-col p-4 gap-1 overflow-y-auto scrollbar-hide">
            {[
              { id: 'takeout', label: 'Google Takeout', icon: <Database size={14} /> },
              { id: 'facebook', label: 'Facebook Export', icon: <Facebook size={14} /> },
              { id: 'apple-health', label: 'Apple Health', icon: <Heart size={14} /> },
              { id: 'photos', label: 'Photos / EXIF', icon: <Camera size={14} /> },
              { id: 'whatsapp', label: 'WhatsApp Chat', icon: <MessageSquare size={14} /> },
              { id: 'browser', label: 'Browser History', icon: <Globe size={14} /> },
              { id: 'financial', label: 'Financial CSV', icon: <CreditCard size={14} /> },
              { id: 'breadcrumb-zip', label: 'Breadcrumb ZIP', icon: <Archive size={14} /> },
              { id: 'csv', label: 'CSV/TSV Loader', icon: <FileUp size={14} /> },
              { id: 'inspector', label: 'ZIP Inspector', icon: <Search size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all mb-0.5 ${
                  activeTab === tab.id ? 'bg-[#d4af37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] font-bold' : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 overflow-auto">
            <div className="max-w-2xl mx-auto space-y-8">
              {activeTab === 'inspector' && file ? (
                <div className="space-y-4">
                  <h3 className="text-[11px] font-mono uppercase text-white/40 flex items-center gap-2">
                    <Archive size={14} />
                    ZIP Contents Browser
                  </h3>
                  <div className="p-4 bg-black border border-white/5 rounded-2xl max-h-[500px] overflow-auto scrollbar-hide">
                    <table className="w-full text-left font-mono text-[9px] uppercase tracking-tighter">
                      <thead className="text-white/20 border-b border-white/5">
                        <tr>
                          <th className="pb-2">Path</th>
                          <th className="pb-2 text-right">Size (B)</th>
                        </tr>
                      </thead>
                      <tbody className="text-white/50">
                        {stats?.paths?.slice(0, 100).map((p: any, i: number) => (
                          <tr key={i} className="border-b border-white/[0.02]">
                            <td className="py-1 truncate max-w-xs">{p}</td>
                            <td className="py-1 text-right">{Math.floor(Math.random() * 1000)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center gap-4 bg-white/[0.02] relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-white/20 rounded-3xl blur opacity-0 group-hover:opacity-10 transition-opacity" />
                  <FileUp size={48} className="text-white/10 mb-2 group-hover:text-[#d4af37]/30 transition-colors" />
                  <div className="text-center">
                    <p className="text-sm text-white/60 font-medium">Drop evidence or select file</p>
                    <p className="text-[10px] font-mono text-white/20 mt-1 uppercase tracking-widest font-bold">
                      {activeTab === 'csv' || activeTab === 'financial' || activeTab === 'whatsapp' ? 'Supports .csv, .txt, .xml' : 'Supports .zip, .json'}
                    </p>
                  </div>
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    accept=".zip,.json,.csv,.txt,.xml"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              )}

              {file && stats?.nodes === 0 && !isProcessing && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 text-yellow-500 text-xs">
                  <ShieldAlert size={16} />
                  <span>No intelligence items detected in this file for the current tab. Ensure the file format matches.</span>
                </div>
              )}

              {file && activeTab !== 'csv' && activeTab !== 'inspector' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <Archive size={20} className="text-[#d4af37]" />
                      <div>
                        <p className="text-sm font-bold text-white">{file.name}</p>
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest leading-none mt-1">Ready for analysis</p>
                      </div>
                    </div>
                    <button 
                      onClick={runImport}
                      disabled={isProcessing}
                      className="px-6 py-2 bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-mono uppercase rounded-full hover:bg-[#d4af37]/20 flex items-center gap-2 transition-all"
                    >
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                      Run Deterministic Scan
                    </button>
                  </div>

                  {stats && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Files Inspected</p>
                        <p className="text-xl font-serif italic text-[#d4af37]">{stats.filesDetected}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Nodes Extracted</p>
                        <p className="text-xl font-serif italic text-[#d4af37]">{stats.nodes}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Links Established</p>
                        <p className="text-xl font-serif italic text-[#d4af37]">{stats.links}</p>
                      </div>
                    </div>
                  )}

                  {/* Forensic Terminal Log */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30 font-bold">Forensic Log Stream</span>
                       <span className="text-[9px] font-mono text-white/20">AGENT_PROTOCOL_v0.2.1-STABLE</span>
                    </div>
                    <div className="h-40 bg-black/60 rounded-2xl border border-white/5 p-4 font-mono text-[9px] overflow-y-auto scrollbar-hide space-y-1 shadow-inner">
                      {logs.length === 0 ? (
                        <div className="text-white/10 italic">Awaiting investigator input...</div>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className={`flex gap-3 leading-relaxed ${log.includes('ERROR') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400' : log.includes('WARNING') ? 'text-yellow-400' : 'text-white/30'}`}>
                            <span className="opacity-20 shrink-0">[{i+1}]</span>
                            <span className="break-all">{log}</span>
                          </div>
                        ))
                      )}
                      {isProcessing && (
                        <div className="flex gap-2 items-center text-white/20 italic animate-pulse">
                          <Loader2 size={10} className="animate-spin" />
                          Streaming byte-data...
                        </div>
                      )}
                    </div>
                  </div>

                  {previewGraph && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-mono uppercase text-white/40 flex items-center gap-2">
                          <Code size={14} />
                          Intelligence Graph JSON (Preview)
                        </h3>
                        <button 
                          onClick={() => onImportComplete(previewGraph)}
                          className="px-6 py-3 bg-[#d4af37] text-black text-[11px] font-bold uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                          Integrate into Current Workspace
                        </button>
                      </div>
                      <pre className="p-6 bg-black rounded-2xl border border-white/5 text-[10px] font-mono text-white/40 overflow-auto max-h-64 scrollbar-hide">
                        {JSON.stringify(previewGraph, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
