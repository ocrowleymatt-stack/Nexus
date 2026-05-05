/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { SearchResult } from '../types';
import { Maximize, Search, Target, Minimize } from 'lucide-react';

import { ErrorBoundary } from './ErrorBoundary';

interface NetworkMapProps {
  data: SearchResult;
  onNodeClick?: (node: any) => void;
  selectedNode?: any;
}

export const NetworkMap: React.FC<NetworkMapProps> = ({ data, onNodeClick, selectedNode }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fgRef = React.useRef<any>(null);
  const lastCenteredNodeRef = React.useRef<string | null>(null);
  const inactivityRef = React.useRef<NodeJS.Timeout | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn("Exit fullscreen failed", err));
      }
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Wait for DOM to adjust
      requestAnimationFrame(() => {
        if (fgRef.current) fgRef.current.zoomToFit(400, 50);
      });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const resetInactivityTimer = React.useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      if (fgRef.current && data.nodes.length > 0) {
        fgRef.current.zoomToFit(1200, 200);
      }
    }, 45000); 
  }, [data.nodes.length]);

  React.useEffect(() => {
    const handleEvents = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleEvents);
    window.addEventListener('mousedown', handleEvents);
    window.addEventListener('touchstart', handleEvents);
    window.addEventListener('wheel', handleEvents);
    
    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', handleEvents);
      window.removeEventListener('mousedown', handleEvents);
      window.removeEventListener('touchstart', handleEvents);
      window.removeEventListener('wheel', handleEvents);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [resetInactivityTimer]);

  React.useEffect(() => {
    if (fgRef.current) {
      // Configuration for a 'sticky' yet 'elastic' feel
      fgRef.current.d3Force('charge').strength(-200);
      fgRef.current.d3Force('link').distance(80).strength(1);
      fgRef.current.d3Force('center').strength(0.05);
      fgRef.current.d3Force('collide', forceCollide(35));
      
      // Warm up the simulation
      fgRef.current.d3ReheatSimulation();
    }
  }, [data.nodes.length === 0]); // Re-init primarily when clearing/restarting

  React.useEffect(() => {
    if (data.nodes.length > 0 && fgRef.current && data.centralNode !== lastCenteredNodeRef.current) {
      if (data.centralNode) {
        // Track last centered to avoid fighting user zoom during updates
        lastCenteredNodeRef.current = data.centralNode;
        
        const graphNodes = typeof fgRef.current.graphData === 'function' ? fgRef.current.graphData().nodes : graphData.nodes;
        const node = graphNodes.find((n: any) => 
          n.id === data.centralNode || 
          n.name === data.centralNode || 
          (n.label && n.label === data.centralNode)
        );
        
        if (node && typeof node.x === 'number' && !isNaN(node.x)) {
          fgRef.current.centerAt(node.x, node.y, 1000);
          fgRef.current.zoom(2.0, 1000);
        } else {
          // Simulation delay fallback
          const timer = setTimeout(() => {
             if (fgRef.current) {
               const graphNodesRetry = typeof fgRef.current.graphData === 'function' ? fgRef.current.graphData().nodes : graphData.nodes;
               const nodeRetry = graphNodesRetry.find((n: any) => n.id === data.centralNode);
               if (nodeRetry) {
                 fgRef.current.centerAt(nodeRetry.x, nodeRetry.y, 1000);
                 fgRef.current.zoom(2.0, 1000);
               } else {
                 fgRef.current.zoomToFit(800, 100);
               }
             }
          }, 500);
          return () => clearTimeout(timer);
        }
      } else {
        fgRef.current.zoomToFit(1000, 150);
        lastCenteredNodeRef.current = null;
      }
    }
  }, [data.centralNode, data.nodes.length > 0]); 

  React.useEffect(() => {
    if (!containerRef.current) return;

    let timeoutId: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  const graphData = useMemo(() => {
    // We must try to keep node objects stable if we want them to remain clickable/persistent
    const nodes = [...data.nodes];
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Filter invalid links
    const links = data.links.filter(link => {
      const s = link.source && typeof link.source === 'object' ? (link.source as any).id : link.source;
      const t = link.target && typeof link.target === 'object' ? (link.target as any).id : link.target;
      return nodeIds.has(s) && nodeIds.has(t);
    }).map(link => ({...link}));

    // Add a specialized 'System' node for manual expansion if graph is not empty
    if (nodes.length > 0) {
      nodes.push({
        id: 'SYSTEM_EXPAND',
        name: 'EXPAND NETWORK',
        type: 'system',
        description: 'Trigger a manual deep-search expansion of the current network lattice.',
        val: 12
      });
    }

    return { nodes, links };
  }, [data.nodes, data.links]);

  const handleRecenter = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(600, 100);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#050505] overflow-hidden" style={{ touchAction: 'none' }}>
      {(!data.nodes || data.nodes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="p-10 border border-white/5 bg-white/[0.02] rounded-3xl backdrop-blur-md text-center max-w-sm">
            <Search className="text-green-500 mx-auto mb-4 animate-pulse" size={40} />
            <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-2">Network Idle</h3>
            <p className="text-white/40 text-[10px] font-mono leading-relaxed">
              Upload investigative assets or search for an entity to begin mapped intelligence.
            </p>
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-xs font-mono text-green-500/50 uppercase tracking-[0.2em]">Network Topology</h2>
        <div className="mt-1 h-[1px] w-24 bg-green-500/20" />
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button 
          onClick={handleRecenter}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-green-500 hover:border-green-500/50 transition-all group"
          title="Recentre View"
        >
          <Target size={18} className="group-hover:scale-110 transition-transform" />
        </button>
        <button 
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-green-500 hover:border-green-500/50 transition-all group"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>

      <ErrorBoundary>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#050505"
          nodeLabel="name"
          nodeColor={(node: any) => {
            if (node.id === data.centralNode || node.name === data.centralNode) return '#00ff00';
            switch (node.type) {
              case 'person': return '#3b82f6';
              case 'organization': return '#ef4444';
              case 'platform': return '#10b981';
              case 'event': return '#f59e0b';
              case 'source': return '#a855f7';
              default: return '#6b7280';
            }
          }}
          nodeVal={(node: any) => {
            if (node.id === data.centralNode || node.name === data.centralNode) return 20;
            return node.val || 5;
          }}
          linkColor={() => 'rgba(255, 255, 255, 0.4)'}
          linkWidth={3}
          linkDirectionalParticles={4}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleWidth={3}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.1}
          minZoom={0.1}
          maxZoom={10}
          cooldownTicks={400}
          warmupTicks={200}
          enablePointerInteraction={true}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          onNodeClick={onNodeClick}
          onNodeDrag={resetInactivityTimer}
          onZoom={resetInactivityTimer}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = String(node.name || node.label || node.id || 'Unknown');
            
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || isNaN(node.x) || isNaN(node.y)) return;
            const validScale = typeof globalScale === 'number' && !isNaN(globalScale) && globalScale > 0 ? globalScale : 1;

            ctx.beginPath();
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
            const isCentral = node.id === data.centralNode || node.name === data.centralNode;
            ctx.fillStyle = isCentral ? '#00ff00' : (node.color || '#22c55e');
            ctx.fill();

            const fontSize = Math.max(1, Math.min(60, 12 / validScale));
            ctx.font = `${fontSize}px "JetBrains Mono"`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, node.x, node.y + (10 / validScale));
          }}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || isNaN(node.x) || isNaN(node.y)) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          d3VelocityDecay={0.4}
          d3AlphaDecay={0.03}
          d3AlphaMin={0.005}
        />
      </ErrorBoundary>
      
      {/* HUD Elements */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-4 text-[10px] font-mono text-muted uppercase">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Person
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" /> Org
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Platform
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500" /> Event
        </div>
      </div>
    </div>
  );
};
