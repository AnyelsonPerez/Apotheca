import { describe, it, expect, vi } from 'vitest'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AuthProvider, useAuth } from './useAuth'
import { setTokens, clearTokens, getAccessToken } from '../api/client'

function TestConsumer() {
  const { isAuthenticated, user, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</span>
      <span data-testid="user-email">{user?.email ?? 'no-user'}</span>
      <button onClick={() => login({ id: '1', email: 'test@test.com', name: 'Test', is_admin: false }, { access_token: 'tok', refresh_token: 'ref', token_type: 'bearer' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

function renderWithMantine(ui: React.ReactElement) {
  return render(
    <MantineProvider defaultColorScheme="light">
      <AuthProvider>{ui}</AuthProvider>
    </MantineProvider>
  )
}

describe('AuthProvider', () => {
  it('starts unauthenticated when no token in storage', () => {
    clearTokens()
    renderWithMantine(<TestConsumer />)
    expect(screen.getByTestId('auth-state')).toHaveTextContent('not-authenticated')
  })

  it('starts authenticated when token exists in storage', () => {
    setTokens('existing-token', 'existing-refresh')
    renderWithMantine(<TestConsumer />)
    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated')
  })

  it('login() sets the user and persists tokens', async () => {
    clearTokens()
    renderWithMantine(<TestConsumer />)
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated')
    })
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@test.com')
    expect(getAccessToken()).toBe('tok')
  })

  it('logout() clears user and tokens', async () => {
    setTokens('existing-token', 'existing-refresh')
    renderWithMantine(<TestConsumer />)
    fireEvent.click(screen.getByText('Logout'))
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('not-authenticated')
    })
    expect(getAccessToken()).toBeNull()
  })
})
