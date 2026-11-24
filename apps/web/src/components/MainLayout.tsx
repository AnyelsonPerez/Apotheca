import { AppShell, Burger, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink as RouterLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/search', label: 'Buscar' },
  { to: '/inventory', label: 'Inventario' },
  { to: '/settings', label: 'Ajustes' },
  { to: '/app', label: 'App móvil' },
]

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg" c="teal.7">Apotheca</Text>
          </Group>
          {isAuthenticated && (
            <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={logout}>
              Cerrar sesión
            </Text>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            component={RouterLink}
            to={item.to}
            label={item.label}
            active={location.pathname === item.to}
            onClick={() => toggle()}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  )
}
