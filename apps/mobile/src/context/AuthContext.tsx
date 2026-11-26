import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, clearTokens, getAccessToken, setTokens } from '../api/client'
import type { TokenResponse, User } from '../api/types'

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  isAuthLoading: boolean
  login: (tokens: TokenResponse) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  isAuthLoading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getAccessToken().then(async (token) => {
      if (!token) {
        if (!cancelled) setIsAuthLoading(false)
        return
      }
      try {
        const me = await apiFetch<User>('/auth/me')
        if (!cancelled) {
          setUser(me)
          setIsAuthenticated(true)
        }
      } catch {
        await clearTokens()
        if (!cancelled) {
          setUser(null)
          setIsAuthenticated(false)
        }
      } finally {
        if (!cancelled) setIsAuthLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const login = async (tokens: TokenResponse) => {
    await setTokens(tokens)
    setIsAuthenticated(true)
    try {
      const me = await apiFetch<User>('/auth/me')
      setUser(me)
    } catch {
      // Token is valid enough; user info is secondary
    }
  }

  const logout = async () => {
    await clearTokens()
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isAuthLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
