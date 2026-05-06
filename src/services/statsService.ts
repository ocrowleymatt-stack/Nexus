import { apiUrl } from './apiBase'

export type DashboardStats = {
  investigations: number
  files: number
  dataPoints: number
  claims?: number
  entities?: number
  source: 'backend' | 'local'
}

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  try {
    const response = await fetch(apiUrl('/api/stats'))
    const text = await response.text()
    const data = JSON.parse(text)

    if (!response.ok) {
      throw new Error(data?.error || `Stats request failed (${response.status})`)
    }

    return {
      investigations: Number(data.investigations || 0),
      files: Number(data.files || 0),
      dataPoints: Number(data.dataPoints || 0),
      claims: Number(data.claims || 0),
      entities: Number(data.entities || 0),
      source: 'backend',
    }
  } catch (err) {
    console.warn('[STATS] Falling back to local dashboard counters:', err)
    return null
  }
}
