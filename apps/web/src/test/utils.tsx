import { type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import { clearTokens } from '../api/client'

const theme = createTheme({ primaryColor: 'teal', defaultRadius: 'md' })

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  })
}

interface RenderWithProvidersOptions extends RenderOptions {
  route?: string
  keepTokens?: boolean
}

export function renderWithProviders(
  ui: ReactNode,
  { route = '/', keepTokens = false, ...renderOptions }: RenderWithProvidersOptions = {},
) {
  if (!keepTokens) clearTokens()
  const queryClient = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </MantineProvider>
    </MemoryRouter>
  )
  return { queryClient, ...render(ui, { wrapper, ...renderOptions }) }
}

export { default as userEvent } from '@testing-library/user-event'
export { render }
