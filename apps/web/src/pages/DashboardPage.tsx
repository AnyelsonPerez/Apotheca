import { Alert, Card, Grid, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle, IconBell, IconPill, IconCalendarClock } from '@tabler/icons-react'
import { useAlerts, useInventory } from '../api/hooks'

export function DashboardPage() {
  const { data: inventory } = useInventory()
  const { data: alerts } = useAlerts()

  const totalMeds = inventory?.length ?? 0
  const totalUnits = inventory?.reduce((sum, m) => sum + m.total_quantity, 0) ?? 0
  const expiryCount = alerts?.expiry.length ?? 0
  const depletionCount = alerts?.depletion.length ?? 0

  const stats = [
    { label: 'Medicamentos', value: totalMeds, icon: IconPill, color: 'teal' },
    { label: 'Unidades totales', value: totalUnits, icon: IconPill, color: 'blue' },
    { label: 'Alertas caducidad', value: expiryCount, icon: IconCalendarClock, color: 'orange' },
    { label: 'Alertas agotamiento', value: depletionCount, icon: IconAlertTriangle, color: 'red' },
  ]

  return (
    <div>
      <Text fw={700} size="xl" mb="md">Dashboard</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} withBorder shadow="sm" padding="lg">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{s.label}</Text>
                  <Text size="xl" fw={700}>{s.value}</Text>
                </div>
                <ThemeIcon color={s.color} variant="light" size="lg">
                  <Icon size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          )
        })}
      </SimpleGrid>

      {(expiryCount > 0 || depletionCount > 0) && (
        <Grid>
          {expiryCount > 0 && (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Alert icon={<IconCalendarClock size={16} />} title="Caducidades próximas" color="orange" variant="light">
                Hay {expiryCount} lote(s) próximo(s) a caducar.
              </Alert>
            </Grid.Col>
          )}
          {depletionCount > 0 && (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Alert icon={<IconAlertTriangle size={16} />} title="Agotamiento próximo" color="red" variant="light">
                Hay {depletionCount} lote(s) próximo(s) a agotarse.
              </Alert>
            </Grid.Col>
          )}
        </Grid>
      )}

      {expiryCount === 0 && depletionCount === 0 && (
        <Alert icon={<IconBell size={16} />} title="Sin alertas" color="green" variant="light">
          No hay alertas activas en este momento.
        </Alert>
      )}
    </div>
  )
}
