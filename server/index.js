import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import ingest from './routes/ingest.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nexus', runtime: 'cloud-run' })
})

app.use('/ingest', ingest)

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Nexus running on port ${PORT}`)
})
