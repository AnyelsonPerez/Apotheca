import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { storage, mockFetch } from '../test/setup'
import { normaliseApiUrl, getApiUrl, setApiUrl, hasServerUrl, clearApiUrl } from './client'

beforeEach(() => {
  storage.clear()
  mockFetch.mockReset()
})

afterEach(() => {
  clearApiUrl()
})

describe('normaliseApiUrl', () => {
  it('appends /api if missing', () => {
    expect(normaliseApiUrl('http://192.168.1.1')).toBe('http://192.168.1.1/api')
    expect(normaliseApiUrl('https://example.com')).toBe('https://example.com/api')
  })

  it('does not append /api if already present', () => {
    expect(normaliseApiUrl('http://192.168.1.1/api')).toBe('http://192.168.1.1/api')
    expect(normaliseApiUrl('https://example.com/api')).toBe('https://example.com/api')
  })

  it('strips trailing slashes', () => {
    expect(normaliseApiUrl('http://192.168.1.1/')).toBe('http://192.168.1.1/api')
    expect(normaliseApiUrl('http://192.168.1.1/api/')).toBe('http://192.168.1.1/api')
  })

  it('throws on non-http protocol', () => {
    expect(() => normaliseApiUrl('ftp://example.com')).toThrow('URL inválida')
    expect(() => normaliseApiUrl('example.com')).toThrow('URL inválida')
  })

  it('throws on empty string', () => {
    expect(() => normaliseApiUrl('')).toThrow('URL inválida')
  })

  it('handles case-insensitive /api suffix', () => {
    expect(normaliseApiUrl('http://192.168.1.1/API')).toBe('http://192.168.1.1/API')
    expect(normaliseApiUrl('http://192.168.1.1/Api')).toBe('http://192.168.1.1/Api')
  })
})

describe('getApiUrl', () => {
  it('returns cached value on subsequent calls', async () => {
    await setApiUrl('http://10.0.0.1')
    const url1 = await getApiUrl()
    const url2 = await getApiUrl()
    expect(url1).toBe('http://10.0.0.1/api')
    expect(url2).toBe(url1)
  })

  it('returns default when nothing stored', async () => {
    clearApiUrl()
    const url = await getApiUrl()
    expect(url).toContain('/api')
  })
})

describe('setApiUrl', () => {
  it('stores normalised URL in AsyncStorage', async () => {
    await setApiUrl('http://192.168.50.8')
    expect(storage.get('apotheca_api_url')).toBe('http://192.168.50.8/api')
    expect(await hasServerUrl()).toBe(true)
  })

  it('caches the URL for subsequent getApiUrl calls', async () => {
    await setApiUrl('https://myserver.com')
    expect(await getApiUrl()).toBe('https://myserver.com/api')
  })
})

describe('hasServerUrl', () => {
  it('returns false when nothing stored', async () => {
    expect(await hasServerUrl()).toBe(false)
  })

  it('returns true after setApiUrl', async () => {
    await setApiUrl('http://192.168.1.100')
    expect(await hasServerUrl()).toBe(true)
  })
})

describe('clearApiUrl', () => {
  it('removes stored URL and cache', async () => {
    await setApiUrl('http://192.168.1.100')
    clearApiUrl()
    expect(await hasServerUrl()).toBe(false)
  })
})
