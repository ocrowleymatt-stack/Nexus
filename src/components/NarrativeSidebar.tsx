/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { SearchResult } from '../types';
import { X, Search, Info, ShieldAlert } from 'lucide-react';

interface NarrativeSidebarProps {
  data: SearchResult;
  onClose: () => void;
}

export const NarrativeSidebar: React.FC<NarrativeSidebarProps> = ({ data, onClose }) => {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute right-0 top-0 h-full w-full md:w-[450px] bg-[#0c0c0c] border-l border-white/10 z-30 flex flex-col shadow-2xl"
    >
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#111]">
        <div>
          <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest">Case Profile</h3>
          <h2 className="text-xl font-bold mt-1 text-white">{data.centralNode}</h2>
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
            <Info size={14} className="text-blue-500" />
            <h4 className="text-xs font-mono uppercase tracking-wider text-blue-500">Narrative Intelligence</h4>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-mono prose-headings:uppercase prose-headings:text-xs prose-headings:tracking-widest prose-headings:text-white/40">
             <ReactMarkdown>{data.narrative}</ReactMarkdown>
          </div>
        </section>

        <section>
           <div className="flex items-center gap-2 mb-4">
            <Search size={14} className="text-green-500" />
            <h4 className="text-xs font-mono uppercase tracking-wider text-green-500">Entity Connections</h4>
          </div>
          <div className="space-y-3">
            {data.nodes.map(node => (
              <div key={node.id} className="p-4 bg-white/5 border border-white/5 rounded hover:border-white/20 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-white/80 group-hover:text-white">{node.name}</span>
                  <span className={ `text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${
                    node.type === 'person' ? 'bg-blue-500/20 text-blue-400' :
                    node.type === 'organization' ? 'bg-red-500/20 text-red-400' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {node.type}
                  </span>
                </div>
                {node.description && (
                  <p className="text-xs text-white/40 leading-relaxed font-sans">{node.description}</p>
                )}
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
