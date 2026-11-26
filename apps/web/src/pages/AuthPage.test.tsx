import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers } from '../test/mocks/handlers'
import { renderWithProviders } from '../test/utils'
import { AuthPage } from './AuthPage'
import { clearTokens, setTokens, getAccessToken } from '../api/client'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('AuthPage', () => {
  it('renders the Apotheca title', () => {
    clearTokens()
    renderWithProviders(<AuthPage />)
    expect(screen.getByText('Apotheca')).toBeInTheDocument()
  })

  it('shows login form by default', () => {
    clearTokens()
    renderWithProviders(<AuthPage />)
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('switches to register mode when clicking the anchor', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.click(screen.getByText('Regístrate'))
    expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('switches back to login from register', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.click(screen.getByText('Regístrate'))
    await user.click(screen.getByText('Inicia sesión'))
    expect(screen.queryByPlaceholderText('Tu nombre')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('shows validation error for short password on login', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'short')
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => {
      expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid email', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'not-an-email')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument()
    })
  })

  it('submits login form and stores tokens on success', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { route: '/login' })
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'testpassword123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => {
      expect(getAccessToken()).toBe('mock-access-token')
    })
  })

  it('shows error on wrong credentials', async () => {
    clearTokens()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'wrong@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => {
      // The error notification or the API error message should appear
      expect(screen.getByText(/incorrectos/i)).toBeInTheDocument()
    })
  })
})
