import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'
import ingest from './routes/ingest.js'
import aiRoutes from './routes/ai.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const PORT = 3000

  app.use(cors())
  app.use(express.json({ limit: '500mb' }))
  app.use(express.urlencoded({ extended: true, limit: '500mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nexus', runtime: 'cloud-run' })
  })

  app.use('/ingest', ingest)
  app.use('/api/ai', aiRoutes)

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, '..', 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus running on port ${PORT}`)
  })
}

startServer()
