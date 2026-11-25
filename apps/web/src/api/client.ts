// In production (nginx), the API is at /api. In dev, Vite proxies /api -> 127.0.0.1:8000.
const API_URL = import.meta.env.VITE_API_URL ?? '/api'

const TOKEN_KEY = 'apotheca_token'
const REFRESH_KEY = 'apotheca_refresh'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      clearTokens()
      return null
    }
    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return data.access_token
  } catch {
    clearTokens()
    return null
  }
}

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/password-reset', '/auth/password-reset/confirm']

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }
  if (token && !isPublic) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && !isPublic) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${API_URL}${path}`, { ...options, headers })
    } else {
      window.dispatchEvent(new CustomEvent('apotheca:unauthorized'))
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'API Error')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
