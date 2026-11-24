import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, clearTokens, getAccessToken, setTokens } from '../api/client'
import type { TokenResponse, User } from '../api/types'

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  login: (tokens: TokenResponse) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    getAccessToken().then((token) => {
      if (token) setIsAuthenticated(true)
    })
  }, [isAuthenticated])

  const login = async (tokens: TokenResponse) => {
    await setTokens(tokens)
    setIsAuthenticated(true)
  }

  const logout = async () => {
    await clearTokens()
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
