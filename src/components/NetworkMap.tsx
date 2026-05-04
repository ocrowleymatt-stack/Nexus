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

export const NetworkMap: React.FC<NetworkMapProps> = ({ data, onNodeClick }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const graphData = useMemo(() => ({
    nodes: data.nodes,
    links: data.links
  }), [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#050505]">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-xs font-mono text-green-500/50 uppercase tracking-[0.2em]">Network Topology</h2>
        <div className="mt-1 h-[1px] w-24 bg-green-500/20" />
      </div>

      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#050505"
        nodeLabel="name"
        nodeColor={(node: any) => {
          switch (node.type) {
            case 'person': return '#3b82f6';
            case 'organization': return '#ef4444';
            case 'platform': return '#10b981';
            case 'event': return '#f59e0b';
            default: return '#6b7280';
          }
        }}
        linkColor={() => 'rgba(255, 255, 255, 0.1)'}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12/globalScale;
          ctx.font = `${fontSize}px "JetBrains Mono"`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = node.color || '#fff';
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions; // to let nodeClick work
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
        }}
        onNodeClick={onNodeClick}
        d3VelocityDecay={0.3}
      />
      
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
