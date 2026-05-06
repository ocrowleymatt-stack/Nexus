import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'
import ingest from './routes/ingest.js'
import aiRoutes from './routes/ai.js'
import uploadRoute from './routes/upload.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const PORT = process.env.PORT || 3000;

  app.use(cors())
  app.use(express.json({ limit: '2048mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2048mb' }))

  // Request logging
  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  // 🔥 Ensure API routes ALWAYS come before static/Vite middleware
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nexus', runtime: 'cloud-run' })
  })

  app.use('/ingest', ingest)
  app.use('/api/ai', aiRoutes)
  app.use('/api/upload', uploadRoute)

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, '..', 'dist')
    app.use(express.static(distPath))
  }

  // 🔥 Catch-all for SPA: Only fallback for NON-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ingest')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    
    if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(__dirname, '..', 'dist')
      res.sendFile(path.join(distPath, 'index.html'))
    } else {
      // In dev, Vite handles the SPA fallback via its middleware
      // but we can add an explicit fallback if needed or just let it pass
      res.status(404).send('Not Found')
    }
  })

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus running on port ${PORT}`)
  })
}

startServer()
