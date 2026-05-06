/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Node {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'event' | 'platform' | 'location' | 'system' | 'other';
  description?: string;
  val: number; // size for visualization
}

export interface Link {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

export interface NarrativeSection {
  title: string;
  content: string;
}

export interface SearchResult {
  nodes: Node[];
  links: Link[];
  narrative?: string;
  centralNode?: string;
}

export type LayoutTemplate = 'force' | 'isometric' | 'helix' | 'fractal' | 'constellation'
export type MapDepth = 'flat' | 'relief' | 'deep'

export type VisualSettings = {
  theme: 'default' | 'gold' | 'neon' | 'monochrome'
  nodeShape: 'circle' | 'square' | 'diamond' | 'hexagon'
  linkStyle: 'default' | 'thin' | 'thick'
  layoutTemplate: LayoutTemplate
  mapDepth: MapDepth
  autoSpatialExpand: boolean
  showDataFlags: boolean
}

export interface AppState {
  isSearching: boolean;
  error: string | null;
  results: SearchResult | null;
  history: string[];
}
