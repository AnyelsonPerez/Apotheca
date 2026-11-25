import { useEffect, useState } from 'react'
import { Button, Card, Group, Stack, Text, TextInput, Loader, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSettings, useUpdateSetting } from '../api/hooks'

export function SettingsPage() {
  const { data: settings, isLoading, isError, error } = useSettings()
  const updateSetting = useUpdateSetting()
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {}
      settings.forEach((s) => { map[s.key] = s.value })
      setValues(map)
    }
  }, [settings])

  const handleSave = (key: string) => {
    updateSetting.mutate(
      { key, value: values[key] ?? '' },
      {
        onSuccess: () => notifications.show({ message: 'Configuración guardada', color: 'green' }),
        onError: (err) => notifications.show({ message: String(err.message), color: 'red' }),
      },
    )
  }

  const labels: Record<string, string> = {
    expiry_warning_days: 'Días de aviso de caducidad',
    depletion_threshold_days: 'Días de aviso de agotamiento',
    ntfy_topic: 'Topic de ntfy',
    ntfy_url: 'URL de ntfy',
  }

  return (
    <Stack>
      <Text fw={700} size="xl">Ajustes</Text>

      {isLoading && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}

      {isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
          No se pudieron cargar los ajustes: {error instanceof Error ? error.message : 'Error desconocido'}
        </Alert>
      )}

      {settings && (
        <Card withBorder shadow="sm" padding="lg">
          <Stack gap="md">
            {settings.map((s) => (
              <Group key={s.key} align="flex-end" gap="sm">
                <TextInput
                  label={labels[s.key] ?? s.key}
                  style={{ flex: 1 }}
                  value={values[s.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                />
                <Button variant="light" color="teal" loading={updateSetting.isPending} onClick={() => handleSave(s.key)}>
                  Guardar
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
