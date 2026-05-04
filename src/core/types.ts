export type EvidentialStatus =
  | 'proven'
  | 'probable'
  | 'possible'
  | 'disputed'
  | 'contradicted'
  | 'untested'
  | 'requires_primary_source_check'

export type ClaimCategory =
  | 'fact'
  | 'inference'
  | 'hypothesis'
  | 'allegation'
  | 'legal_argument'
  | 'creative_theme'
  | 'public_narrative_point'

export type HumanReviewStatus = 'unchecked' | 'checked' | 'disputed' | 'locked'

export type SourceType =
  | 'transcript'
  | 'email'
  | 'pdf'
  | 'screenshot'
  | 'contact_export'
  | 'court_doc'
  | 'police_record'
  | 'witness_note'
  | 'metadata'
  | 'csv'
  | 'json'
  | 'other'

export type SourceRecord = {
  source_id: string
  source_type: SourceType
  title: string
  raw_file?: string
  raw_preserved: boolean
  text_extracted: boolean
  extracted_text?: string
  date_received?: string
  entities_extracted: string[]
  events_extracted: string[]
  claims_extracted: string[]
  relationship_edges: string[]
  quotes: string[]
  legal_tags: string[]
  osint_tags: string[]
  creative_tags: string[]
  public_narrative_tags: string[]
  risk_tags: string[]
  confidence: 'low' | 'moderate' | 'high'
  human_review_status: HumanReviewStatus
  output_destinations: string[]
}

export type EntityRecord = {
  entity_id: string
  name: string
  entity_type: 'person' | 'organisation' | 'place' | 'phone' | 'email' | 'reference_number' | 'document' | 'unknown'
  aliases: string[]
  linked_phone_numbers: string[]
  linked_addresses: string[]
  confidence: 'low' | 'mixed' | 'moderate' | 'high'
  source_refs: string[]
}

export type EventRecord = {
  event_id: string
  date?: string
  approximate_date?: string
  event_type: string
  title: string
  people: string[]
  locations: string[]
  source_refs: string[]
  evidential_status: EvidentialStatus
  confidence: 'low' | 'moderate' | 'high'
  legal_relevance: string[]
  osint_relevance: string[]
  creative_relevance: string[]
  public_narrative_relevance: string[]
}

export type ClaimRecord = {
  claim_id: string
  claim: string
  category: ClaimCategory
  status: EvidentialStatus
  supporting_sources: string[]
  contradicting_sources: string[]
  confidence: 'low' | 'moderate' | 'high'
  usable_in: string[]
  unsafe_wording?: string
  safe_wording: string
}

export type RelationshipRecord = {
  relationship_id: string
  source: string
  target: string
  relationship_type: string
  strength: 'weak' | 'moderate' | 'strong'
  category: 'fact' | 'inference' | 'hypothesis'
  basis: string[]
  notes?: string
}

export type ContradictionRecord = {
  contradiction_id: string
  title: string
  description: string
  source_refs: string[]
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'resolved' | 'parked'
}
