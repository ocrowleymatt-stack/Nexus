import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Lazy-load Vite only in development (avoids crashing in production if
//    vite is absent or misconfigured)
async function getViteMiddleware() {
  try {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: process.cwd(),
    })
    return vite.middlewares
  } catch (err) {
    console.warn('[WARN] Vite dev server unavailable:', err.message)
    return null
  }
}

// ── Lazy-load route modules so a missing env var in ai.js does NOT crash
//    the whole server — each route module is wrapped in try/catch
async function loadRoutes(app) {
  try {
    const { default: ingest } = await import('./routes/ingest.js')
    app.use('/ingest', ingest)
    console.log('[SERVER] /ingest routes loaded')
  } catch (err) {
    console.error('[ERROR] Failed to load ingest routes:', err.message)
    app.use('/ingest', (_req, res) => res.status(503).json({ error: 'Ingest service unavailable', detail: err.message }))
  }

  try {
    const { default: aiRoutes } = await import('./routes/ai.js')
    app.use('/api/ai', aiRoutes)
    console.log('[SERVER] /api/ai routes loaded')
  } catch (err) {
    console.error('[ERROR] Failed to load AI routes:', err.message)
    app.use('/api/ai', (_req, res) => res.status(503).json({ error: 'AI service unavailable — set GEMINI_API_KEY or Venice env var', detail: err.message }))
  }

  try {
    const { default: githubRoutes } = await import('./routes/github.js')
    app.use('/api/github', githubRoutes)
    console.log('[SERVER] /api/github routes loaded')
  } catch (err) {
    console.error('[ERROR] Failed to load GitHub routes:', err.message)
    app.use('/api/github', (_req, res) => res.status(503).json({ error: 'GitHub service unavailable', detail: err.message }))
  }
}

async function startServer() {
  const app = express()
  const PORT = process.env.PORT || 3000

  app.use(cors())
  app.use(express.json({ limit: '2048mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2048mb' }))

  // Request logging
  app.use((req, _res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`)
    next()
  })

  // ── Health check (always available, even if AI routes fail) ──
  app.get('/health', (_req, res) => {
    const aiConfigured = !!(process.env.GEMINI_API_KEY || process.env.Venice || process.env.VENICE_API_KEY)
    res.json({
      ok: true,
      service: 'nexus',
      runtime: 'cloud-run',
      ai: aiConfigured ? 'configured' : 'no-keys-set',
    })
  })

  // ── Load API routes defensively ──
  await loadRoutes(app)

  // ── Static file serving ──
  if (process.env.NODE_ENV !== 'production') {
    const viteMiddleware = await getViteMiddleware()
    if (viteMiddleware) {
      app.use(viteMiddleware)
    } else {
      const distPath = path.join(__dirname, '..', 'dist')
      app.use(express.static(distPath))
    }
  } else {
    const distPath = path.join(__dirname, '..', 'dist')
    app.use(express.static(distPath))
  }

  // ── SPA catch-all: only for non-API routes ──
  app.use('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ingest')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(__dirname, '..', 'dist')
      res.sendFile(path.join(distPath, 'index.html'))
    } else {
      console.log(`[SERVER_404] Resource not handled: ${req.url}`)
      res.status(404).send('Not Found')
    }
  })

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`)
    const aiKeys = [
      process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY=set' : 'GEMINI_API_KEY=missing',
      (process.env.Venice || process.env.VENICE_API_KEY) ? 'Venice=set' : 'Venice=missing',
    ]
    console.log(`[SERVER] AI config: ${aiKeys.join(' | ')}`)
  })
}

startServer().catch((err) => {
  console.error('[FATAL] Server failed to start:', err)
  process.exit(1)
})
