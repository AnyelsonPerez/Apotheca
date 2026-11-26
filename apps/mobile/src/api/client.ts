import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TokenResponse } from './types'

const TOKEN_KEY = 'apotheca_token'
const REFRESH_KEY = 'apotheca_refresh'
const API_URL_KEY = 'apotheca_api_url'

const DEFAULT_API_URL = __DEV__
  ? 'http://10.0.2.2:8000/api' // Android emulator -> host localhost (vite dev or uvicorn)
  : 'http://10.0.2.2:8000/api'

const API_SUFFIX = '/api'

/** Normalise a user-entered server URL: strip trailing slashes, append /api if missing. */
function normaliseApiUrl(raw: string): string {
  const clean = raw.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(clean)) throw new Error('URL inválida: debe empezar por http:// o https://')
  // Append /api if the user hasn't already
  if (/\/api$/i.test(clean)) return clean
  return clean + API_SUFFIX
}

let cachedApiUrl: string | null = null
const apiUrlListeners = new Set<(url: string | null) => void>()

/** Returns the full base URL including /api suffix (e.g. http://192.168.50.8/api). */
export async function getApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl
  const stored = await AsyncStorage.getItem(API_URL_KEY)
  const raw = stored ?? DEFAULT_API_URL
  const url = normaliseApiUrl(raw)
  cachedApiUrl = url
  return url
}

export async function setApiUrl(url: string): Promise<void> {
  const clean = normaliseApiUrl(url)
  await AsyncStorage.setItem(API_URL_KEY, clean)
  cachedApiUrl = clean
  apiUrlListeners.forEach((cb) => cb(clean))
}

/** Returns true if the user has explicitly set a server URL. */
export async function hasServerUrl(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(API_URL_KEY)
  return stored !== null && stored.length > 0
}

/** Returns the stored API URL (normalised) or null if the user hasn't set one. */
export async function getStoredApiUrl(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(API_URL_KEY)
  if (!stored) return null
  return normaliseApiUrl(stored)
}

export function clearApiUrl(): void {
  cachedApiUrl = null
  AsyncStorage.removeItem(API_URL_KEY)
}

export function onApiUrlChange(cb: (url: string | null) => void): () => void {
  apiUrlListeners.add(cb)
  return () => { apiUrlListeners.delete(cb) }
}

// Resolve the API base URL for this request (cached after first call)
async function apiBase(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl
  const stored = await AsyncStorage.getItem(API_URL_KEY)
  cachedApiUrl = normaliseApiUrl(stored ?? DEFAULT_API_URL)
  return cachedApiUrl
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function setTokens(tokens: TokenResponse): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, tokens.access_token)
  await AsyncStorage.setItem(REFRESH_KEY, tokens.refresh_token)
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY)
  await AsyncStorage.removeItem(REFRESH_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  const [refresh, base] = await Promise.all([AsyncStorage.getItem(REFRESH_KEY), apiBase()])
  if (!refresh) return null
  try {
    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      await clearTokens()
      return null
    }
    const data: TokenResponse = await res.json()
    await setTokens(data)
    return data.access_token
  } catch {
    await clearTokens()
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const [token, base] = await Promise.all([getAccessToken(), apiBase()])
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${base}${path}`, { ...options, headers })

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${base}${path}`, { ...options, headers })
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'API Error')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
