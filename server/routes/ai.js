import express from 'express'
import { deepSearchEntity, extractIntelligenceFromCsv, huntZipIntelligence } from '../utils/ai.js'

const router = express.Router()

router.post('/search', async (req, res) => {
  const { query } = req.body
  try {
    const result = await deepSearchEntity(query)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/extract-csv', async (req, res) => {
  const { csvContent } = req.body
  try {
    const result = await extractIntelligenceFromCsv(csvContent)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/hunt-zip', async (req, res) => {
  const { zipName, fileTree, fileSamples } = req.body
  try {
    const result = await huntZipIntelligence(zipName, fileTree, fileSamples)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router
