import { useState } from 'react'
import { Badge, Button, Card, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconSearch, IconPlus, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useAddMedication, useCimaSearch, useCreateLot } from '../api/hooks'
import type { CimaSearchResult } from '../api/types'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useCimaSearch(query)
  const addMedication = useAddMedication()

  // Lot modal state — the medication is only saved when the user hits "Guardar"
  const [lotModal, setLotModal] = useState<{ med: CimaSearchResult } | null>(null)
  const [lotForm, setLotForm] = useState({ quantity: 0, daily_dose: '', expiry_date: null as string | Date | null })
  const createLot = useCreateLot()

  const handleAdd = (r: CimaSearchResult) => {
    setLotForm({ quantity: 0, daily_dose: '', expiry_date: null })
    setLotModal({ med: r })
  }

  const handleCreateLot = async () => {
    if (!lotModal) return
    try {
      const med = await addMedication.mutateAsync(lotModal.med.nregistro)
      await createLot.mutateAsync({
        medication_id: med.id,
        quantity: lotForm.quantity,
        daily_dose: lotForm.daily_dose ? Number(lotForm.daily_dose) : null,
        expiry_date: lotForm.expiry_date ? new Date(lotForm.expiry_date).toISOString() : null,
      })
      notifications.show({ message: 'Lote guardado', color: 'green' })
      setLotModal(null)
    } catch (err) {
      notifications.show({ message: String(err instanceof Error ? err.message : err), color: 'red' })
    }
  }

  const inventoryResults = data?.inventory ?? []
  const cimaResults = data?.cima ?? []

  const renderResult = (r: CimaSearchResult, fromInventory: boolean) => {
    const alreadyInInventory = fromInventory || r.in_inventory
    return (
      <Card key={`${r.nregistro}-${fromInventory}`} withBorder padding="sm">
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1 }}>
            <Group gap="xs" align="center">
              <Text fw={500} size="sm">{r.nombre}</Text>
              {alreadyInInventory && (
                <Badge size="xs" variant="light" color="teal" leftSection={<IconCheck size={10} />}>
                  En inventario
                </Badge>
              )}
              {r.cpresc && r.cpresc !== 'Sin Receta' && (
                <Badge size="xs" variant="light" color="red">Con receta</Badge>
              )}
            </Group>
            {r.pactivos && <Text size="xs" c="dimmed">{r.pactivos}</Text>}
            <Group mt={4} gap="xs">
              <Badge size="xs" variant="light">{r.nregistro}</Badge>
              {r.labtitular && <Badge size="xs" variant="light" color="gray">{r.labtitular}</Badge>}
              {r.dosis && <Badge size="xs" variant="light" color="blue">{r.dosis}</Badge>}
            </Group>
          </div>
          <Button
            size="xs"
            variant={alreadyInInventory ? 'light' : 'filled'}
            color="teal"
            leftSection={<IconPlus size={14} />}
            loading={addMedication.isPending}
            onClick={() => handleAdd(r)}
          >
            {alreadyInInventory ? 'Añadir lote' : 'Añadir'}
          </Button>
        </Group>
      </Card>
    )
  }

  return (
    <Stack>
      <Text fw={700} size="xl">Buscar medicamento</Text>
      <TextInput
        placeholder="Busca por nombre o principio activo…"
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Stack gap="xs">
        {isFetching && <Text c="dimmed">Buscando…</Text>}

        {!isFetching && query.length >= 2 && inventoryResults.length === 0 && cimaResults.length === 0 && (
          <Text c="dimmed">Sin resultados</Text>
        )}

        {inventoryResults.length > 0 && (
          <>
            <Text size="sm" fw={600} c="teal.7" mt="xs">En tu inventario</Text>
            {inventoryResults.map((r) => renderResult(r, true))}
          </>
        )}

        {cimaResults.length > 0 && (
          <>
            <Text size="sm" fw={600} c="dimmed" mt="xs">Resultados de CIMA ({data?.total_cima ?? cimaResults.length} total)</Text>
            {cimaResults.map((r) => renderResult(r, false))}
          </>
        )}
      </Stack>

      <Modal
        opened={!!lotModal}
        onClose={() => setLotModal(null)}
        title={
          <Group gap="xs">
            <IconPlus size={18} color="#0CA678" />
            <Text fw={600}>Añadir lote</Text>
          </Group>
        }
      >
        <Stack>
          <Text size="sm" c="dimmed">{lotModal?.med.nombre}</Text>
          {lotModal?.med.dosis && (
            <Badge variant="light" color="blue" w="fit-content">{lotModal.med.dosis}</Badge>
          )}
          <NumberInput
            label="Cantidad"
            min={0}
            value={lotForm.quantity}
            onChange={(v) => setLotForm({ ...lotForm, quantity: Number(v) || 0 })}
          />
          <DateInput
            label="Fecha de caducidad"
            placeholder="Selecciona la fecha"
            valueFormat="DD/MM/YYYY"
            value={lotForm.expiry_date}
            onChange={(v) => setLotForm({ ...lotForm, expiry_date: v })}
            clearable
          />
          <TextInput
            label="Dosis diaria"
            placeholder="2.5"
            value={lotForm.daily_dose}
            onChange={(e) => setLotForm({ ...lotForm, daily_dose: e.target.value })}
          />
          <Button color="teal" loading={addMedication.isPending || createLot.isPending} onClick={handleCreateLot}>
            Guardar
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
