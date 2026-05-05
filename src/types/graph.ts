
export type SourceConfidence = "direct" | "inferred" | "weak";
export type SourceType = 
  | "google_takeout" 
  | "facebook_export" 
  | "apple_health" 
  | "whatsapp" 
  | "browser_history" 
  | "financial" 
  | "photos_metadata"
  | "csv_import" 
  | "manual";

export type LinkBasis = "fact_from_file" | "metadata_inference" | "user_supplied";

export interface SourceRef {
  source_type: SourceType;
  source_file: string;
  source_index?: number;
  source_confidence: SourceConfidence;
  timestamp?: string;
  basis?: LinkBasis;
}

export interface NexusNode {
  id: string;
  name: string;
  label?: string; // Friendly label
  type: "person" | "device" | "location" | "account" | "app" | "event" | "file" | "transaction" | "health_metric" | "message_thread" | "unknown" | string;
  description?: string;
  group?: string;
  source_ref?: SourceRef;
  metadata?: Record<string, any>;
  first_seen?: string;
  last_seen?: string;
  raw_excerpt?: string;
}

export interface NexusLink {
  source: string;
  target: string;
  relationship: string;
  source_ref?: SourceRef;
  weight?: number;
  timestamp?: string;
  confidence?: SourceConfidence;
  basis?: LinkBasis;
}

export interface NexusGraph {
  nodes: NexusNode[];
  links: NexusLink[];
  centralNode?: string;
}
