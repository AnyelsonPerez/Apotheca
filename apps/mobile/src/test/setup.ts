import { vi } from 'vitest'

// React Native defines __DEV__ globally; vitest/node doesn't
vi.stubGlobal('__DEV__', true)

// Mock AsyncStorage — the mobile API client depends on it
const storage = new Map<string, string>()

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value)
      return Promise.resolve()
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key)
      return Promise.resolve()
    }),
  },
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

export { storage, mockFetch }
