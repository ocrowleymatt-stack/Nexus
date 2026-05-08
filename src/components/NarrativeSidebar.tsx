/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { SearchResult } from '../types';
import { X, Search, Info, ShieldAlert, Gavel, Loader2 } from 'lucide-react';
import { forensicSearchNode } from '../services/geminiService';

interface NarrativeSidebarProps {
  data: SearchResult;
  onClose: () => void;
}

export const NarrativeSidebar: React.FC<NarrativeSidebarProps> = ({ data, onClose }) => {
  const [forensicReports, setForensicReports] = useState<Record<string, string>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  const [seedImage] = useState(() => localStorage.getItem('nexus_forensic_seed'));

  const handleForensicSearch = async (nodeId: string, nodeName: string) => {
    setLoadingNodes(prev => ({ ...prev, [nodeId]: true }));
    try {
      const report = await forensicSearchNode(nodeName || nodeId);
      setForensicReports(prev => ({ ...prev, [nodeId]: report }));
    } catch (err) {
      console.error(err);
      setForensicReports(prev => ({ ...prev, [nodeId]: "Search failed or no records accessible." }));
    } finally {
      setLoadingNodes(prev => ({ ...prev, [nodeId]: false }));
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute right-0 top-0 h-full w-full md:w-[450px] bg-[#0c0c0c] border-l border-white/10 z-[80] flex flex-col shadow-2xl"
    >
      <div className="p-6 pt-20 border-b border-white/5 flex justify-between items-start bg-[#111]">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 flex items-center justify-center border border-[#d4af37]/20 shrink-0 overflow-hidden">
             <img 
                src={seedImage || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200"} 
                className="w-full h-full object-cover rounded-xl grayscale brightness-110 contrast-125"
                alt="Agent"
                referrerPolicy="no-referrer"
             />
          </div>
          <div>
            <div className="flex flex-col -mb-1">
              <span className="text-[8px] font-mono tracking-[0.4em] text-[#d4af37]/60 uppercase">O'CROWLEY // NEXUS</span>
              <h2 className="text-xl font-display font-black text-white">{data.centralNode}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Active Investigation Dossier</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Info size={14} className="text-[#d4af37]" />
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#d4af37]">Lattice Narrative</h4>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-black prose-headings:text-base prose-headings:text-white/80">
             <ReactMarkdown>{data.narrative}</ReactMarkdown>
          </div>
        </section>

        <section>
           <div className="flex items-center gap-2 mb-4">
            <Search size={14} className="text-[#d4af37]" />
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#d4af37]">Evidence Links</h4>
          </div>
          <div className="space-y-4">
            {data.nodes.map(node => (
              <div key={node.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-[#d4af37]/30 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-display font-black text-white group-hover:text-[#d4af37] transition-colors">{node.name || node.id}</span>
                  <span className={ `text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${
                    node.type === 'person' ? 'bg-blue-500/20 text-blue-400' :
                    node.type === 'organization' ? 'bg-red-500/20 text-red-400' :
                    'bg-white/10 text-white/40'
                   }`}>
                    {node.type}
                  </span>
                </div>
                
                {node.description && (
                  <p className="text-[11px] text-white/40 leading-relaxed font-sans mb-3">{node.description}</p>
                )}

                <div className="pt-2 border-t border-white/5 space-y-3">
                  <button
                    onClick={() => handleForensicSearch(node.id, node.name || node.id)}
                    disabled={loadingNodes[node.id]}
                    className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-red-500/70 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {loadingNodes[node.id] ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Gavel size={10} />
                    )}
                    Legal/Forensic Deep Dive
                  </button>

                  <AnimatePresence>
                    {forensicReports[node.id] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2 text-[8px] font-bold uppercase tracking-widest text-red-500">
                          <ShieldAlert size={10} />
                          Legal Nexus Spotlight
                        </div>
                        <div className="text-[10px] text-white/60 leading-relaxed prose prose-invert prose-xs">
                          <ReactMarkdown>{forensicReports[node.id]}</ReactMarkdown>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-4 bg-red-500/5 border-t border-red-500/10 flex items-center gap-3">
        <ShieldAlert size={16} className="text-red-500/50" />
        <span className="text-[10px] font-mono text-red-500/50 uppercase tracking-tight">Grounded via Real-time Google Search Intelligence</span>
      </div>
    </motion.div>
  );
};
