
import { sanitiseId, cleanText } from './sanitise';
import { NexusGraph, NexusNode, NexusLink, SourceRef } from '../../types/graph';

export class GraphBuilder {
  private nodes: Map<string, NexusNode> = new Map();
  private links: NexusLink[] = [];
  private nodeLimit = 3000;
  private linkLimit = 8000;

  constructor(limits?: { nodes?: number; links?: number }) {
    if (limits?.nodes) this.nodeLimit = limits.nodes;
    if (limits?.links) this.linkLimit = limits.links;
  }

  addNode(node: Omit<NexusNode, 'id'> & { id?: string }): string {
    if (this.nodes.size >= this.nodeLimit) {
      console.warn("Node limit reached");
      return "";
    }
    
    const rawId = node.id || node.name;
    const id = sanitiseId(rawId);
    
    if (this.nodes.has(id)) {
      const existing = this.nodes.get(id)!;
      // Update temporal bounds if present
      if (node.first_seen && (!existing.first_seen || node.first_seen < existing.first_seen)) {
        existing.first_seen = node.first_seen;
      }
      if (node.last_seen && (!existing.last_seen || node.last_seen > existing.last_seen)) {
        existing.last_seen = node.last_seen;
      }
      return id;
    }

    this.nodes.set(id, {
      ...node,
      id,
      name: cleanText(node.name),
      label: node.label || cleanText(node.name),
      description: node.description ? cleanText(node.description) : undefined
    });
    
    return id;
  }

  addLink(link: NexusLink): void {
    if (this.links.length >= this.linkLimit) {
      console.warn("Link limit reached");
      return;
    }
    
    // Ensure both nodes exist
    const s = sanitiseId(link.source);
    const t = sanitiseId(link.target);
    
    if (!this.nodes.has(s) || !this.nodes.has(t)) return;

    // Avoid exact duplicates
    const exists = this.links.some(l => 
      l.source === s && l.target === t && l.relationship === link.relationship
    );

    if (!exists) {
      this.links.push({
        ...link,
        source: s,
        target: t
      });
    }
  }

  getGraph(): NexusGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      links: this.links
    };
  }

  getNodeCount(): number { return this.nodes.size; }
  getLinkCount(): number { return this.links.length; }
}
