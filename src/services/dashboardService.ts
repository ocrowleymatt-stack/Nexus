export type DashboardStats = {
  source: 'api' | 'local'
  investigations: number
  files: number
  dataPoints: number
  entities: number
  correlations: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard/stats')

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Dashboard stats unavailable' }))
    throw new Error(err.error || 'Dashboard stats unavailable')
  }

  const data = await response.json()
  return {
    source: 'api',
    investigations: Number(data.investigations ?? data.projects ?? 0),
    files: Number(data.files ?? data.documents ?? 0),
    dataPoints: Number(data.dataPoints ?? data.data_points ?? data.nodes ?? 0),
    entities: Number(data.entities ?? data.nodes ?? 0),
    correlations: Number(data.correlations ?? data.links ?? 0)
  }
}
