import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import ingest from './routes/ingest.js'
import aiRoutes from './routes/ai.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()

  // 🔥 FIX: Cloud Run requires PORT env
  const PORT = process.env.PORT || 8080

  app.use(cors())
  app.use(express.json({ limit: '500mb' }))
  app.use(express.urlencoded({ extended: true, limit: '500mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nexus', runtime: 'cloud-run' })
  })

  // 🔥 Ensure API routes ALWAYS come before static
  app.use('/ingest', ingest)
  app.use('/api/ai', aiRoutes)

  // 🔥 Production static handling
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  // 🔥 Only fallback for NON-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus running on port ${PORT}`)
  })
}

startServer()
