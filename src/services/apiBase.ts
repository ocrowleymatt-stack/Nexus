const configuredBaseUrl = import.meta.env.VITE_NEXUS_API_BASE_URL?.trim()

export const API_BASE_URL = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : ''

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
