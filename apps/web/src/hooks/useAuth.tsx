import { createContext, useContext, useState, type ReactNode } from 'react'
import { clearTokens, getAccessToken, setTokens as persistTokens } from '../api/client'
import type { TokenResponse, User } from '../api/types'

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  login: (user: User, tokens: TokenResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAccessToken())
  const [user, setUser] = useState<User | null>(null)

  const login = (user: User, tokens: TokenResponse) => {
    persistTokens(tokens.access_token, tokens.refresh_token)
    setUser(user)
    setIsAuthenticated(true)
  }

  const logout = () => {
    clearTokens()
    setUser(null)
    setIsAuthenticated(false)
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
