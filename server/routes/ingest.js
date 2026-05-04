import express from 'express'
import { extractEntities } from '../utils/entities.js'

const router = express.Router()

const store = {
  sources: [],
  claims: [],
  entities: []
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function classifyClaim(text) {
  if (/confirmed|recorded|evidence/i.test(text)) return 'fact'
  if (/appears|suggests|likely/i.test(text)) return 'inference'
  return 'hypothesis'
}

router.post('/', async (req, res) => {
  const { text, title } = req.body

  if (!text) {
    return res.status(400).json({ error: 'No text provided' })
  }

  const sourceId = makeId('SRC')

  const source = {
    source_id: sourceId,
    title: title || 'Untitled Source',
    raw: text,
    createdAt: new Date().toISOString()
  }

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const claims = lines.map(line => ({
    claim_id: makeId('CLM'),
    text: line,
    type: classifyClaim(line),
    source_refs: [sourceId]
  }))

  const entities = extractEntities(text).map(e => ({
    entity_id: makeId('ENT'),
    name: e.name,
    type: e.type,
    confidence: e.confidence,
    source_refs: [sourceId]
  }))

  store.sources.push(source)
  store.claims.push(...claims)
  store.entities.push(...entities)

  res.json({
    source,
    claims,
    entities
  })
})

export default router
