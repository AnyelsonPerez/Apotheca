import { createContext, useContext, useState, type ReactNode } from 'react'
import { clearTokens, getAccessToken } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  login: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token] = useState(getAccessToken())
  const [user, setUser] = useState<User | null>(null)

  const login = (user: User) => setUser(user)
  const logout = () => {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
