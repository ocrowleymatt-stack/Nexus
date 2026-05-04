import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Search, Upload, Target, Info, ShieldCheck } from 'lucide-react';

export const NexusGuide: React.FC = () => {
  const steps = [
    {
      icon: <Search className="text-green-500" size={20} />,
      title: "Deep Search Intelligence",
      description: "Enter any entity or topic. Nexus uses Gemini grounded with Google Search to build a preliminary intelligence graph from public data."
    },
    {
      icon: <Upload className="text-blue-500" size={20} />,
      title: "Custom Data Ingest",
      description: "Upload CSVs (contacts, transactions) or ZIP files (case files). The engine extracts key entities and links them to your existing graph."
    },
    {
      icon: <Target className="text-purple-500" size={20} />,
      title: "Manual Evidence",
      description: "Paste transcripts, notes, or raw signals into the Manual Ingest panel. Nexus parses these into source-linked claims and evidence nodes."
    },
    {
      icon: <BookOpen className="text-yellow-500" size={20} />,
      title: "Narrative Mapping",
      description: "Click any node to inspect its description and source references. Use 'Center on Node' to refocus your investigation."
    }
  ];

  return (
    <div className="space-y-8 py-4 px-2">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
          Welcome to Nexus
        </h2>
        <p className="text-xs text-white/40 font-mono uppercase tracking-[0.2em]">
          Evidence & Narrative Mapping Engine
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-green-500/30 transition-all hover:bg-white/[0.08] group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-black/40 rounded-lg group-hover:scale-110 transition-transform">
                {step.icon}
              </div>
              <h3 className="font-bold text-sm">{step.title}</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-4">
        <div className="p-2 bg-green-500/20 rounded-lg shrink-0">
          <ShieldCheck className="text-green-500" size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-500">Intelligence Guard</h4>
          <p className="text-[10px] text-white/60 leading-normal">
            Nexus automatically deduplicates entities by name. If two sources mention the same person with different details, 
            their profiles are merged into a single canonical node with an updated history.
          </p>
        </div>
      </div>

      <div className="text-[10px] font-mono text-center text-white/20 uppercase tracking-widest pt-4">
        Powered by Gemini 3 Flash & Google Search Grounding
      </div>
    </div>
  );
};
