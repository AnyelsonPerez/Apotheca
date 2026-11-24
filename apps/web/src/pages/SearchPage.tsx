import { useState } from 'react'
import { Badge, Button, Card, Group, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useAddMedication, useCimaSearch } from '../api/hooks'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'name' | 'active'>('name')
  const { data: results, isFetching } = useCimaSearch(query, searchType)
  const addMedication = useAddMedication()

  const list = results ?? []

  const handleAdd = (nregistro: string) => {
    addMedication.mutate(nregistro, {
      onSuccess: () => {
        notifications.show({ message: 'Medicamento añadido al inventario', color: 'green' })
      },
      onError: (err) => {
        notifications.show({ message: String(err.message), color: 'red' })
      },
    })
  }

  return (
    <Stack>
      <Text fw={700} size="xl">Buscar medicamento</Text>
      <SegmentedControl
        value={searchType}
        onChange={(v) => setSearchType(v as 'name' | 'active')}
        data={[
          { label: 'Por nombre', value: 'name' },
          { label: 'Por principio activo', value: 'active' },
        ]}
      />
      <TextInput
        placeholder="Escribe al menos 2 caracteres…"
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Stack gap="xs">
        {isFetching && <Text c="dimmed">Buscando…</Text>}
        {!isFetching && list.length === 0 && query.length >= 2 && (
          <Text c="dimmed">Sin resultados</Text>
        )}
        {list.map((r) => (
          <Card key={r.nregistro} withBorder padding="sm">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Text fw={500} size="sm">{r.nombre}</Text>
                <Text size="xs" c="dimmed">{r.pactivos}</Text>
                <Group mt={4} gap="xs">
                  <Badge size="xs" variant="light">{r.nregistro}</Badge>
                  {r.labtitular && <Badge size="xs" variant="light" color="gray">{r.labtitular}</Badge>}
                  {r.cpresc && r.cpresc !== 'Sin Receta' && (
                    <Badge size="xs" variant="light" color="red">Con receta</Badge>
                  )}
                </Group>
              </div>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconPlus size={14} />}
                loading={addMedication.isPending}
                onClick={() => handleAdd(r.nregistro)}
              >
                Añadir
              </Button>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
