import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import { MainLayout } from './MainLayout'
import { setTokens } from '../api/client'

describe('MainLayout', () => {
  it('renders the Apotheca brand name', () => {
    setTokens('fake', 'fake')
    renderWithProviders(<MainLayout><div>Content</div></MainLayout>, { keepTokens: true })
    expect(screen.getAllByText('Apotheca').length).toBeGreaterThan(0)
  })

  it('renders nav links', () => {
    setTokens('fake', 'fake')
    renderWithProviders(<MainLayout><div>Content</div></MainLayout>, { keepTokens: true })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Buscar')).toBeInTheDocument()
    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })

  it('renders children content', () => {
    setTokens('fake', 'fake')
    renderWithProviders(<MainLayout><div data-testid="child">Child Content</div></MainLayout>, { keepTokens: true })
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows logout link when authenticated', () => {
    setTokens('fake', 'fake')
    renderWithProviders(<MainLayout><div>Content</div></MainLayout>, { keepTokens: true })
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument()
  })
})
