import express from 'express'
import { 
  callVeniceAI, 
  deepSearchEntity, 
  extractIntelligenceFromCsv, 
  forensicSearchNode, 
  testHypothesis, 
  expandGraph, 
  extractIntelligenceFromText,
  extractIntelligenceFromUrl,
  huntZipIntelligence 
} from '../utils/ai.js'

const router = express.Router()

router.post('/extract-url', async (req, res) => {
  const { url } = req.body
  try {
    const result = await extractIntelligenceFromUrl(url)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/hunt-zip', async (req, res) => {
  const { zipName, fileTree, fileSamples } = req.body
  try {
    const result = await huntZipIntelligence(zipName, fileTree, fileSamples)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/deep-search', async (req, res) => {
  const { entityName } = req.body
  try {
    const result = await deepSearchEntity(entityName)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/extract-csv', async (req, res) => {
  const { csvContent } = req.body
  try {
    const result = await extractIntelligenceFromCsv(csvContent)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/forensic-search', async (req, res) => {
  const { entityName } = req.body
  try {
    const result = await forensicSearchNode(entityName)
    res.json({ text: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/test-hypothesis', async (req, res) => {
  const { hypothesis, contextNodes } = req.body
  try {
    const result = await testHypothesis(hypothesis, contextNodes)
    res.json({ text: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/expand-graph', async (req, res) => {
  const { existingData } = req.body
  try {
    const result = await expandGraph(existingData)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/extract-text', async (req, res) => {
  const { text } = req.body
  try {
    const result = await extractIntelligenceFromText(text)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/sense-check', async (req, res) => {
  const { graph, narrative } = req.body
  
  const prompt = `
    You are an expert investigative auditor. Review the following intelligence graph and narrative for errors, biases, or logical leaps.
    
    NARRATIVE:
    ${narrative}
    
    GRAPH DATA:
    Nodes: ${JSON.stringify(graph.nodes.map(n => ({ id: n.id, type: n.type, label: n.label || n.name })))}
    Links: ${JSON.stringify(graph.links)}
    
    Provide a "Sense Check" report in Markdown format. 
    1. Identify potential gaps in the logic.
    2. Suggest 3 specific "Red Team" questions to challenge the current theory.
    3. Rate the "Investigation Confidence" on a scale of 1-10.
    
    CRITICAL: ALWAYS REPLY WITH A JSON OBJECT IN THE FOLLOWING FORMAT:
    {
      "text": "your markdown report here"
    }
  `

  try {
    const result = await callVeniceAI(prompt)
    res.json(result)
  } catch (err) {
    console.error("Venice Sense Check failed:", err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/venice-clean', async (req, res) => {
  const { existingData } = req.body
  const prompt = `
    You are an advanced Intelligence Engine (Project Venice). Your goal is to analyze, prune, and expand the provided graph data.
    
    1. DELETE: Identify and remove erroneous, trivial, redundant, or strictly irrelevant nodes/links.
    2. EXPAND: Infer new connections, implicitly understood world knowledge about the remaining nodes, and add highly relevant key missing nodes.
    3. NARRATIVE: Rewrite the narrative to "make sense of this mess" based on the refined graph.

    Data:
    ${JSON.stringify(existingData)}

    Respond exactly and only with JSON in the following format:
    {
      "nodes": [ { "id": "string", "name": "string", "description": "string", "type": "person|organization|event|source", "val": 5 } ],
      "links": [ { "source": "string", "target": "string", "relationship": "string" } ],
      "narrative": "string"
    }
  `
  try {
    const result = await callVeniceAI(prompt)
    res.json(result)
  } catch (err) {
    console.error("Venice Clean failed:", err)
    res.status(500).json({ error: err.message })
  }
})

export default router
