import { ActionIcon, AppShell, Burger, Group, NavLink, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink as RouterLink, useLocation } from 'react-router-dom'
import { IconSun, IconMoon } from '@tabler/icons-react'
import { useMantineColorScheme } from '@mantine/core'
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
  const { colorScheme, setColorScheme } = useMantineColorScheme()

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
          <Group gap="sm">
            <Tooltip label={colorScheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                aria-label="Cambiar tema"
              >
                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            {isAuthenticated && (
              <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={logout}>
                Cerrar sesión
              </Text>
            )}
          </Group>
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
