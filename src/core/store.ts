import {
  SourceRecord,
  EntityRecord,
  EventRecord,
  ClaimRecord,
  RelationshipRecord,
  ContradictionRecord
} from './types'

export const store = {
  sources: [] as SourceRecord[],
  entities: [] as EntityRecord[],
  events: [] as EventRecord[],
  claims: [] as ClaimRecord[],
  relationships: [] as RelationshipRecord[],
  contradictions: [] as ContradictionRecord[]
}

export function resetStore() {
  store.sources = []
  store.entities = []
  store.events = []
  store.claims = []
  store.relationships = []
  store.contradictions = []
}
