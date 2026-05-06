import React from 'react';
import { Palette, Share2, Circle, Square, Diamond, Hexagon, Layers, Wind, Info, Orbit, Box, Sparkles, Snowflake, Network, ScanSearch } from 'lucide-react';
import { VisualSettings } from '../types';

interface VisualSettingsPanelProps {
  settings: VisualSettings;
  onChange: (settings: VisualSettings) => void;
}

const THEMES = [
  { id: 'default', name: 'Obsidian Mint', color: '#10b981' },
  { id: 'gold', name: 'Sovereign Gold', color: '#d4af37' },
  { id: 'neon', name: 'Electric Pulse', color: '#f472b6' },
  { id: 'monochrome', name: 'Silent Shadow', color: '#9ca3af' },
] as const;

const SHAPES = [
  { id: 'circle', name: 'Orb', icon: Circle },
  { id: 'square', name: 'Block', icon: Square },
  { id: 'diamond', name: 'Shard', icon: Diamond },
  { id: 'hexagon', name: 'Cell', icon: Hexagon },
] as const;

const LINK_STYLES = [
  { id: 'thin', name: 'Fiber' },
  { id: 'default', name: 'Standard' },
  { id: 'thick', name: 'Cable' },
] as const;

const LAYOUT_TEMPLATES = [
  { id: 'force', name: 'Force', description: 'Organic 2D force map', icon: Network },
  { id: 'isometric', name: '3D Iso', description: 'Layered pseudo-3D evidence stack', icon: Box },
  { id: 'helix', name: 'Helix', description: 'Spiral timeline / chain view', icon: Orbit },
  { id: 'fractal', name: 'Fractal', description: 'Self-similar clusters for hidden motifs', icon: Snowflake },
  { id: 'constellation', name: 'Stars', description: 'Radial hub-and-spoke pattern field', icon: Sparkles },
] as const;

const DEPTH_MODELS = [
  { id: 'flat', name: 'Flat' },
  { id: 'relief', name: 'Relief' },
  { id: 'deep', name: 'Deep' },
] as const;

export default function VisualSettingsPanel({ settings, onChange }: VisualSettingsPanelProps) {
  const updateSetting = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Theme Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Palette size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Chromatic Schema</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSetting('theme', t.id)}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-2 group ${
                settings.theme === t.id 
                  ? 'bg-white/10 border-white/40' 
                  : 'bg-white/5 border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}44` }} 
                />
                <div className={`w-2 h-2 rounded-full border border-white/20 ${settings.theme === t.id ? 'bg-white' : ''}`} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Node Shape */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Layers size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Entity Geometry</h4>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => updateSetting('nodeShape', s.id)}
                className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                  settings.nodeShape === s.id 
                    ? 'bg-white/10 border-white/40 text-white' 
                    : 'bg-white/5 border-white/5 text-white/30 hover:border-white/20 hover:text-white/60'
                }`}
                title={s.name}
              >
                <Icon size={18} />
                <span className="text-[8px] font-bold uppercase tracking-tighter">{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout Templates */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <ScanSearch size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">3D / Pattern Templates</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                onClick={() => updateSetting('layoutTemplate', template.id)}
                className={`p-3 rounded-xl border transition-all text-left flex items-start gap-3 ${
                  settings.layoutTemplate === template.id
                    ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]'
                    : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <Icon size={16} className="mt-0.5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest">{template.name}</span>
                  <span className="text-[8px] font-mono uppercase leading-tight opacity-60">{template.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Depth Model */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Box size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Depth Model</h4>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
          {DEPTH_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => updateSetting('mapDepth', model.id)}
              className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                settings.mapDepth === model.id
                  ? 'bg-white/10 text-white shadow-lg'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>
      </div>

      {/* Link Style */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Share2 size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Correlation Weight</h4>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
          {LINK_STYLES.map((l) => (
            <button
              key={l.id}
              onClick={() => updateSetting('linkStyle', l.id)}
              className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                settings.linkStyle === l.id 
                  ? 'bg-white/10 text-white shadow-lg' 
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Info size={14} />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Heuristic Indicators</h4>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Entity Data Flags</span>
            <span className="text-[9px] font-mono text-white/30 uppercase">Show metadata icons on nodes</span>
          </div>
          <div 
            onClick={() => updateSetting('showDataFlags', !settings.showDataFlags)}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${settings.showDataFlags ? 'bg-[#d4af37]/50' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.showDataFlags ? 'right-1' : 'left-1'}`} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Spatial Auto-Expand</span>
            <span className="text-[9px] font-mono text-white/30 uppercase">Reframe and spread new evidence to reveal patterns</span>
          </div>
          <div
            onClick={() => updateSetting('autoSpatialExpand', !settings.autoSpatialExpand)}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${settings.autoSpatialExpand ? 'bg-[#d4af37]/50' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.autoSpatialExpand ? 'right-1' : 'left-1'}`} />
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="pt-6 border-t border-white/5">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/5 opacity-50">
          <Wind size={16} className="text-white/20" />
          <p className="text-[9px] font-mono text-white/40 leading-relaxed uppercase tracking-tighter">
            Changes are applied in real-time to the active lattice. Visual preferences are persisted locally across sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
