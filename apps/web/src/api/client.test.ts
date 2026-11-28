import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, setTokens, clearTokens, getAccessToken, getRefreshToken } from './client'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('token storage', () => {
  it('setTokens persists both tokens to localStorage', () => {
    setTokens('access123', 'refresh456')
    expect(getAccessToken()).toBe('access123')
    expect(getRefreshToken()).toBe('refresh456')
  })

  it('clearTokens removes both from localStorage', () => {
    setTokens('access123', 'refresh456')
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('getAccessToken returns null when nothing stored', () => {
    expect(getAccessToken()).toBeNull()
  })
})

describe('apiFetch', () => {
  it('makes a GET request to the correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    })
    await apiFetch('/inventory')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/inventory')
    expect(init.method).toBeUndefined()
  })

  it('sends Authorization header when token is set', async () => {
    setTokens('mytoken', 'myrefresh')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    await apiFetch('/inventory')
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer mytoken')
  })

  it('does not send Authorization header for public paths', async () => {
    setTokens('mytoken', 'myrefresh')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    await apiFetch('/auth/login', { method: 'POST' })
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
  })

  it('throws with API detail message on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Bad request' }),
    })
    await expect(apiFetch('/inventory')).rejects.toThrow('Bad request')
  })

  it('falls back to statusText when body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not JSON') },
      statusText: 'Internal Server Error',
    })
    await expect(apiFetch('/inventory')).rejects.toThrow('Internal Server Error')
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    })
    const result = await apiFetch('/inventary/medications/123', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })
})

describe('apiFetch 401 refresh flow', () => {
  it('attempts token refresh on 401', async () => {
    setTokens('expired-access', 'valid-refresh')
    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid or expired token' }),
    })
    // Refresh call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' }),
    })
    // Retry with new token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'success' }),
    })
    const result = await apiFetch('/inventory')
    expect(result).toEqual({ data: 'success' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    // Third call should use new token
    const retryHeaders = mockFetch.mock.calls[2][1].headers
    expect(retryHeaders['Authorization']).toBe('Bearer new-access')
  })

  it('dispatches unauthorized event when refresh fails', async () => {
    setTokens('expired-access', 'also-expired')
    const handler = vi.fn()
    window.addEventListener('apotheca:unauthorized', handler)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid' }),
    })
    // Refresh fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid' }),
    })

    await expect(apiFetch('/inventory')).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('apotheca:unauthorized', handler)
  })
})
