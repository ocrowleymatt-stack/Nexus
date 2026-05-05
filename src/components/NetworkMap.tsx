/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { SearchResult } from '../types';

interface NetworkMapProps {
  data: SearchResult;
  onNodeClick?: (node: any) => void;
}

function safeText(value: unknown, fallback = 'Unknown') {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return text || fallback;
}

function safeId(value: unknown, fallback: string) {
  return safeText(value, fallback).slice(0, 180);
}

export const NetworkMap: React.FC<NetworkMapProps> = ({ data, onNodeClick }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fgRef = React.useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  const graphData = useMemo(() => {
    const nodeMap = new Map<string, any>();

    for (const [index, node] of (data.nodes || []).entries()) {
      const id = safeId((node as any)?.id ?? (node as any)?.name, `node-${index}`);
      nodeMap.set(id, {
        ...(node as any),
        id,
        name: safeText((node as any)?.name ?? (node as any)?.label ?? id, id).slice(0, 120),
        label: safeText((node as any)?.label ?? (node as any)?.name ?? id, id).slice(0, 120),
        type: safeText((node as any)?.type, 'other'),
        description: safeText((node as any)?.description, '')
      });
    }

    if (nodeMap.size === 0) {
      nodeMap.set('Nexus Graph', {
        id: 'Nexus Graph',
        name: 'Nexus Graph',
        label: 'Nexus Graph',
        type: 'other',
        description: 'No nodes available.'
      });
    }

    const links = (data.links || [])
      .map((link: any) => {
        const source = safeId(link?.source, '');
        const target = safeId(link?.target, '');
        if (!source || !target) return null;
        if (!nodeMap.has(source) || !nodeMap.has(target)) return null;
        return {
          ...link,
          source,
          target,
          relationship: safeText(link?.relationship, 'related to')
        };
      })
      .filter(Boolean);

    return {
      nodes: Array.from(nodeMap.values()),
      links
    };
  }, [data]);

  React.useEffect(() => {
    if (data.centralNode && fgRef.current) {
      const central = safeId(data.centralNode, '');
      const node = graphData.nodes.find((n: any) => n.id === central || n.name === central) as any;
      if (node && Number.isFinite(node.x) && Number.isFinite(node.y)) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(2, 1000);
      }
    }
  }, [data.centralNode, graphData.nodes]);

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: Math.max(containerRef.current.clientWidth, 320),
          height: Math.max(containerRef.current.clientHeight, 320),
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#050505]">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-xs font-mono text-green-500/50 uppercase tracking-[0.2em]">Network Topology</h2>
        <div className="mt-1 h-[1px] w-24 bg-green-500/20" />
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#050505"
        nodeLabel={(node: any) => safeText(node.name ?? node.label ?? node.id, 'Node')}
        nodeColor={(node: any) => {
          const central = safeId(data.centralNode, '');
          if (node.id === central || node.name === central) return '#00ff00';
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
          const central = safeId(data.centralNode, '');
          if (node.id === central || node.name === central) return 20;
          return Number.isFinite(node.val) ? node.val : 5;
        }}
        linkColor={() => 'rgba(255, 255, 255, 0.7)'}
        linkWidth={2}
        linkDirectionalParticles={3}
        linkDirectionalParticleSpeed={0.007}
        linkDirectionalParticleWidth={2}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const central = safeId(data.centralNode, '');
          const isCentral = node.id === central || node.name === central;
          const label = safeText(node.name || node.label || node.id, 'Node').slice(0, 80);
          const fontSize = Math.max((isCentral ? 14 : 12) / Math.max(globalScale, 0.4), 2);
          const x = Number.isFinite(node.x) ? node.x : 0;
          const y = Number.isFinite(node.y) ? node.y : 0;
          
          ctx.font = `${isCentral ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => Math.max(n + fontSize * 0.4, 4)); 

          if (isCentral) {
            ctx.beginPath();
            ctx.arc(x, y, (fontSize * 0.8), 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2 / Math.max(globalScale, 0.4);
            ctx.stroke();
          }

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(x - bckgDimensions[0] / 2, y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isCentral ? '#00ff00' : (typeof node.color === 'string' ? node.color : '#fff');
          ctx.fillText(label, x, y);

          node.__bckgDimensions = bckgDimensions;
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          const x = Number.isFinite(node.x) ? node.x : 0;
          const y = Number.isFinite(node.y) ? node.y : 0;
          bckgDimensions && ctx.fillRect(x - bckgDimensions[0] / 2, y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
        }}
        onNodeClick={onNodeClick}
        d3VelocityDecay={0.3}
      />
      
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
