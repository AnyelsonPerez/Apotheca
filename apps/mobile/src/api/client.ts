import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TokenResponse } from './types'

const API_URL = __DEV__
  ? 'http://10.0.2.2:8000' // Android emulator -> host localhost
  : 'https://apotheca.local'

const TOKEN_KEY = 'apotheca_token'
const REFRESH_KEY = 'apotheca_refresh'

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
  const refresh = await AsyncStorage.getItem(REFRESH_KEY)
  if (!refresh) return null
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
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
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${API_URL}${path}`, { ...options, headers })
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'API Error')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export { API_URL }
