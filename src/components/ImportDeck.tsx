
import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
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
  CreditCard,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2
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

type QueueStatus = 'pending' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  nodes?: number;
  links?: number;
  error?: string;
  graph?: NexusGraph;
  logs: string[];
}

export default function ImportDeck({ onImportComplete, onClose }: ImportDeckProps) {
  const [activeTab, setActiveTab] = useState<Tab>('takeout');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const addToQueue = (files: File[]) => {
    const newItems: QueueItem[] = files.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending',
      logs: []
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addToQueue(files);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addToQueue(files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearDone = () => setQueue(prev => prev.filter(q => q.status !== 'done' && q.status !== 'error'));

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const addItemLog = (id: string, msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setQueue(prev => prev.map(q => q.id === id ? { ...q, logs: [...q.logs.slice(-19), line] } : q));
  };

  const processFile = async (item: QueueItem): Promise<NexusGraph | null> => {
    const { file, id } = item;
    updateItem(id, { status: 'processing' });
    addItemLog(id, `STARTING: ${file.name} | MODE: ${activeTab}`);
    try {
      let builder;
      if (activeTab === 'apple-health') {
        addItemLog(id, "Parsing Apple Health XML...");
        builder = await processAppleHealth(file);
      } else if (activeTab === 'whatsapp') {
        addItemLog(id, "Parsing WhatsApp export...");
        builder = await processWhatsAppExport(file);
      } else if (activeTab === 'browser') {
        addItemLog(id, "Parsing Browser History...");
        builder = await processBrowserHistory(file);
      } else if (activeTab === 'financial') {
        addItemLog(id, "Parsing Financial CSV...");
        builder = await processFinancialCsv(file);
      } else if (activeTab === 'csv') {
        addItemLog(id, "Parsing Generic CSV/TSV...");
        builder = await processGenericCsv(file);
      } else {
        addItemLog(id, "Opening ZIP archive...");
        const zipNodes = await inspectZip(file);
        const paths = zipNodes.map(n => n.path);
        addItemLog(id, `ZIP loaded. Entries: ${paths.length}`);
        if (activeTab === 'facebook') builder = await processFacebookExport(file, paths);
        else if (activeTab === 'takeout') builder = await processGoogleTakeout(file, paths);
        else if (activeTab === 'photos') builder = await processPhotosMetadata(file, paths);
        else if (activeTab === 'breadcrumb-zip') builder = await processGoogleTakeout(file, paths);
      }
      if (builder) {
        const graph = builder.getGraph();
        const nodes = builder.getNodeCount();
        const links = builder.getLinkCount();
        addItemLog(id, `SUCCESS: ${nodes} nodes, ${links} links extracted.`);
        updateItem(id, { status: 'done', nodes, links, graph });
        return graph;
      } else {
        throw new Error("Builder not initialized for this tab.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addItemLog(id, `ERROR: ${msg}`);
      updateItem(id, { status: 'error', error: msg });
      return null;
    }
  };

  const runQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsRunning(true);
    const pending = queue.filter(q => q.status === 'pending');
    for (const item of pending) {
      await processFile(item);
    }
    processingRef.current = false;
    setIsRunning(false);
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const doneCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const selectedItem = queue.find(q => q.id === selectedId);

  const statusIcon = (status: QueueStatus) => {
    if (status === 'pending') return <Clock size={14} className="text-white/30" />;
    if (status === 'processing') return <Loader2 size={14} className="text-[#d4af37] animate-spin" />;
    if (status === 'done') return <CheckCircle2 size={14} className="text-green-400" />;
    return <AlertCircle size={14} className="text-red-400" />;
  };

  const statusLabel = (status: QueueStatus) => {
    if (status === 'pending') return 'QUEUED';
    if (status === 'processing') return 'SCANNING';
    if (status === 'done') return 'COMPLETE';
    return 'ERROR';
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
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">Multi-Source Forensic Gathering Agent // v2.1-QUEUE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {queue.length > 0 && (
              <div className="flex items-center gap-2 text-[9px] font-mono text-white/30 uppercase">
                <span className="text-[#d4af37]">{pendingCount} pending</span>
                <span>·</span>
                <span className="text-green-400">{doneCount} done</span>
                {errorCount > 0 && <><span>·</span><span className="text-red-400">{errorCount} error</span></>}
              </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50">
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-56 border-r border-white/5 bg-black/20 flex flex-col p-4 gap-1 overflow-y-auto scrollbar-hide shrink-0">
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

          {/* Main Content — Drop Zone + Queue */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Drop Zone */}
            <div className="p-6 border-b border-white/5">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-3xl flex flex-col items-center gap-3 cursor-pointer transition-all relative group ${
                  isDragging
                    ? 'border-[#d4af37]/60 bg-[#d4af37]/5'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className={`absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-white/20 rounded-3xl blur opacity-0 transition-opacity ${isDragging ? 'opacity-15' : 'group-hover:opacity-10'}`} />
                <FileUp size={36} className={`transition-colors ${isDragging ? 'text-[#d4af37]/60' : 'text-white/10 group-hover:text-[#d4af37]/30'}`} />
                <div className="text-center">
                  <p className="text-sm text-white/60 font-medium">
                    {isDragging ? 'Release to add to queue' : 'Drop multiple files or click to select'}
                  </p>
                  <p className="text-[10px] font-mono text-white/20 mt-1 uppercase tracking-widest font-bold">
                    {activeTab === 'csv' || activeTab === 'financial' || activeTab === 'whatsapp' ? 'Supports .csv, .txt, .xml' : 'Supports .zip, .json — multiple files accepted'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  accept=".zip,.json,.csv,.txt,.xml"
                  className="hidden"
                />
              </div>

              {/* Queue Actions */}
              {queue.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={runQueue}
                      disabled={isRunning || pendingCount === 0}
                      className="px-5 py-2 bg-[#d4af37] text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isRunning ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                      {isRunning ? 'Scanning...' : `Run ${pendingCount} File${pendingCount !== 1 ? 's' : ''}`}
                    </button>
                    <button
                      onClick={clearDone}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white/40 text-[10px] font-mono uppercase rounded-full hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                      <Trash2 size={11} />
                      Clear Done
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-white/20 uppercase">{queue.length} file{queue.length !== 1 ? 's' : ''} in queue</span>
                </div>
              )}
            </div>

            {/* Queue List + Detail Panel */}
            <div className="flex flex-1 overflow-hidden">
              {/* Queue List */}
              <div className="w-72 border-r border-white/5 overflow-y-auto scrollbar-hide p-3 space-y-1 shrink-0">
                {queue.length === 0 ? (
                  <div className="p-6 text-center text-[10px] font-mono text-white/20 uppercase">Queue empty</div>
                ) : (
                  queue.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all group ${
                        selectedId === item.id
                          ? 'bg-white/10 border-white/20'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {statusIcon(item.status)}
                          <span className="text-[10px] text-white/70 truncate font-mono">{item.file.name}</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeFromQueue(item.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-white/30 transition-all shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-[8px] font-mono uppercase tracking-widest ${
                          item.status === 'done' ? 'text-green-400' :
                          item.status === 'error' ? 'text-red-400' :
                          item.status === 'processing' ? 'text-[#d4af37]' :
                          'text-white/20'
                        }`}>{statusLabel(item.status)}</span>
                        {item.status === 'done' && (
                          <span className="text-[8px] font-mono text-white/30">{item.nodes}n · {item.links}l</span>
                        )}
                      </div>
                      {item.status === 'processing' && (
                        <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#d4af37]/60 rounded-full animate-pulse w-2/3" />
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Detail Panel */}
              <div className="flex-1 p-6 overflow-auto">
                {selectedItem ? (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{selectedItem.file.name}</p>
                        <p className="text-[10px] font-mono text-white/30 mt-0.5 uppercase">{(selectedItem.file.size / 1024).toFixed(1)} KB · {activeTab}</p>
                      </div>
                      {selectedItem.status === 'done' && selectedItem.graph && (
                        <button
                          onClick={() => onImportComplete(selectedItem.graph!)}
                          className="px-5 py-2.5 bg-[#d4af37] text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                          Integrate into Workspace
                        </button>
                      )}
                    </div>

                    {selectedItem.status === 'done' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Nodes Extracted</p>
                          <p className="text-2xl font-serif italic text-[#d4af37]">{selectedItem.nodes}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Links Established</p>
                          <p className="text-2xl font-serif italic text-[#d4af37]">{selectedItem.links}</p>
                        </div>
                      </div>
                    )}

                    {selectedItem.status === 'error' && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-xs">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <span>{selectedItem.error}</span>
                      </div>
                    )}

                    {/* Log stream */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30 font-bold">Forensic Log Stream</span>
                        <span className="text-[9px] font-mono text-white/20">AGENT_PROTOCOL_v0.2.1</span>
                      </div>
                      <div className="h-48 bg-black/60 rounded-2xl border border-white/5 p-4 font-mono text-[9px] overflow-y-auto scrollbar-hide space-y-1 shadow-inner">
                        {selectedItem.logs.length === 0 ? (
                          <div className="text-white/10 italic">Awaiting scan...</div>
                        ) : (
                          selectedItem.logs.map((log, i) => (
                            <div key={i} className={`flex gap-3 leading-relaxed ${
                              log.includes('ERROR') ? 'text-red-400' :
                              log.includes('SUCCESS') ? 'text-green-400' :
                              log.includes('WARNING') ? 'text-yellow-400' :
                              'text-white/30'
                            }`}>
                              <span className="opacity-20 shrink-0">[{i+1}]</span>
                              <span className="break-all">{log}</span>
                            </div>
                          ))
                        )}
                        {selectedItem.status === 'processing' && (
                          <div className="flex gap-2 items-center text-white/20 italic animate-pulse">
                            <Loader2 size={10} className="animate-spin" />
                            Streaming byte-data...
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedItem.status === 'done' && selectedItem.graph && (
                      <div className="space-y-2">
                        <h3 className="text-[11px] font-mono uppercase text-white/40 flex items-center gap-2">
                          <Code size={14} />
                          Intelligence Graph JSON (Preview)
                        </h3>
                        <pre className="p-4 bg-black rounded-2xl border border-white/5 text-[9px] font-mono text-white/30 overflow-auto max-h-48 scrollbar-hide">
                          {JSON.stringify(selectedItem.graph, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <FileCheck size={40} className="text-white/10" />
                    <p className="text-[11px] font-mono uppercase text-white/20 tracking-widest">Select a file from the queue to view details</p>
                    {doneCount > 0 && (
                      <p className="text-[10px] font-mono text-green-400/50">{doneCount} file{doneCount !== 1 ? 's' : ''} ready to integrate</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
