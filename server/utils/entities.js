const stopWords = new Set([
  'The', 'This', 'That', 'There', 'These', 'Those', 'It', 'I', 'You', 'He', 'She', 'They', 'We',
  'On', 'In', 'At', 'For', 'From', 'With', 'Without', 'And', 'But', 'Or', 'If', 'Then',
  'Police', 'Report', 'Case', 'Court', 'Evidence', 'Source'
])

export function extractEntities(text) {
  const entities = []
  const seen = new Set()

  const add = (name, type, confidence = 'moderate') => {
    const clean = String(name || '').trim()
    if (!clean || clean.length < 2) return
    const key = `${type}:${clean.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    entities.push({ name: clean, type, confidence })
  }

  const phoneMatches = text.match(/(?:\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}/g) || []
  phoneMatches.forEach(v => add(v, 'phone', 'high'))

  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  emailMatches.forEach(v => add(v, 'email', 'high'))

  const dateMatches = text.match(/\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{2,4})\b/gi) || []
  dateMatches.forEach(v => add(v, 'date', 'high'))

  const referenceMatches = text.match(/\b(?:CAD|CRN|URN|OIC|CO|BCA|CAU|HWF)[-/A-Z0-9]{3,}\b/gi) || []
  referenceMatches.forEach(v => add(v, 'reference_number', 'high'))

  const organisationMatches = text.match(/\b[A-Z][A-Za-z& ]+\s(?:Police|Council|Court|Ltd|Limited|LLP|PLC|University|Hospital|Department|Authority)\b/g) || []
  organisationMatches.forEach(v => add(v, 'organisation', 'moderate'))

  const personMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []
  personMatches.forEach(v => {
    const first = v.split(/\s+/)[0]
    if (!stopWords.has(first)) add(v, 'person', 'low')
  })

  return entities
}
