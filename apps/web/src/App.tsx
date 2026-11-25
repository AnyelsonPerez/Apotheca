import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AppRoutes } from './routes/AppRoutes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
})

function App() {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      colorSchemeManager={localStorageColorSchemeManager({ key: 'apotheca-color-scheme' })}
    >
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  )
}

export default App
