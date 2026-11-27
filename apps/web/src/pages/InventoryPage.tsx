import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { useAlerts, useCreateLot, useDeleteLot, useDeleteMedication, useInventory, useUpdateLot } from '../api/hooks'
import type { InventoryItem, Lot } from '../api/types'

type FilterType = 'all' | 'expiry' | 'depletion'

function isExpiringSoon(dateStr: string): boolean {
  const expiry = new Date(dateStr)
  const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return days <= 30
}

/** Format a Date as YYYY-MM-DD using local components (avoids toISOString UTC off-by-one). */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter: FilterType = searchParams.get('filter') === 'expiry' || searchParams.get('filter') === 'depletion'
    ? searchParams.get('filter') as FilterType
    : 'all'
  const setFilter = (f: FilterType) => setSearchParams(f === 'all' ? {} : { filter: f })
  const { data: inventory, isLoading } = useInventory()
  const { data: alerts } = useAlerts()
  const deleteMed = useDeleteMedication()
  const deleteLot = useDeleteLot()
  const createLot = useCreateLot()
  const updateLot = useUpdateLot()
  const [modalMed, setModalMed] = useState<InventoryItem | null>(null)
  const [editingLot, setEditingLot] = useState<Lot | null>(null)
  const [lotForm, setLotForm] = useState({
    quantity: 0,
    daily_dose: '',
    treatment_days: '',
    dose_start_date: null as string | Date | null,
    expiry_date: null as string | Date | null,
  })

  const openLotModal = (med: InventoryItem) => {
    setModalMed(med)
    setEditingLot(null)
    setLotForm({ quantity: 0, daily_dose: '', treatment_days: '', dose_start_date: null, expiry_date: null })
  }

  const openEditLotModal = (med: InventoryItem, lot: Lot) => {
    setModalMed(med)
    setEditingLot(lot)
    setLotForm({
      quantity: lot.quantity,
      daily_dose: lot.daily_dose != null ? String(lot.daily_dose) : '',
      treatment_days: lot.treatment_days != null ? String(lot.treatment_days) : '',
      dose_start_date: lot.dose_start_date ? new Date(lot.dose_start_date) : null,
      expiry_date: lot.expiry_date ? new Date(lot.expiry_date) : null,
    })
  }

  const closeLotModal = () => {
    setModalMed(null)
    setEditingLot(null)
  }

  const handleSaveLot = async () => {
    if (!modalMed) return
    const lotData = {
      quantity: lotForm.quantity,
      daily_dose: lotForm.daily_dose ? Number(lotForm.daily_dose) : null,
      treatment_days: lotForm.treatment_days ? Number(lotForm.treatment_days) : null,
      dose_start_date: lotForm.dose_start_date ? formatLocalDate(new Date(lotForm.dose_start_date)) : null,
      expiry_date: lotForm.expiry_date ? formatLocalDate(new Date(lotForm.expiry_date)) : null,
    }
    try {
      if (editingLot) {
        await updateLot.mutateAsync({ id: editingLot.id, ...lotData })
        notifications.show({ message: 'Lote actualizado', color: 'green' })
      } else {
        await createLot.mutateAsync({ medication_id: modalMed.id, ...lotData })
        notifications.show({ message: 'Lote añadido', color: 'green' })
      }
      closeLotModal()
    } catch (err) {
      notifications.show({ message: String(err instanceof Error ? err.message : err), color: 'red' })
    }
  }

  const handleDeleteMed = (id: string) => {
    deleteMed.mutate(id, {
      onSuccess: () => notifications.show({ message: 'Medicamento eliminado', color: 'green' }),
      onError: (err) => notifications.show({ message: String(err.message), color: 'red' }),
    })
  }

  const handleDeleteLot = (id: string) => {
    deleteLot.mutate(id, {
      onSuccess: () => notifications.show({ message: 'Lote eliminado', color: 'green' }),
      onError: (err) => notifications.show({ message: String(err.message), color: 'red' }),
    })
  }

  if (isLoading) return <Text c="dimmed">Cargando…</Text>

  const alertedLotIds = filter === 'all'
    ? new Set<string>()
    : new Set((filter === 'expiry' ? alerts?.expiry : alerts?.depletion)?.map((a) => a.lot_id) ?? [])

  const visibleInventory = (inventory ?? []).filter((med) =>
    filter === 'all' ? true : med.lots.some((lot) => alertedLotIds.has(lot.id)),
  )

  const rows = visibleInventory.flatMap((med) => {
    const rows = [
      <Table.Tr key={med.id}>
        <Table.Td>
          <Text fw={500} size="sm">{med.name}</Text>
          <Text size="xs" c="dimmed">{med.active_ingredient_name ?? '—'}</Text>
        </Table.Td>
        <Table.Td>{med.laboratory ?? '—'}</Table.Td>
        <Table.Td>
          <Badge size="sm" variant="light" color={med.total_quantity > 0 ? 'teal' : 'red'}>
            {med.total_quantity}
          </Badge>
        </Table.Td>
        <Table.Td>{med.lots.length}</Table.Td>
        <Table.Td>
          <Group gap="xs">
            <Button size="xs" variant="light" color="teal" leftSection={<IconPlus size={14} />} onClick={() => openLotModal(med)}>
              Lote
            </Button>
            <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteMed(med.id)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>,
    ]
    med.lots
      .filter((lot) => filter === 'all' || alertedLotIds.has(lot.id))
      .forEach((lot) => {
        const alerted = filter !== 'all' && alertedLotIds.has(lot.id)
        rows.push(
          <Table.Tr key={lot.id} bg={alerted ? 'orange.0' : 'gray.0'}>
            <Table.Td pl="xl">
              <Group gap="xs">
                <Text size="xs" c="dimmed">Lote: {lot.id.slice(0, 8)}</Text>
                {lot.expiry_date && (
                  <Text size="xs" c={isExpiringSoon(lot.expiry_date) ? 'red.7' : 'dimmed'}>
                    Cad: {new Date(lot.expiry_date).toLocaleDateString('es-ES')}
                  </Text>
                )}
                {alerted && (
                  <Badge size="xs" variant="light" color={filter === 'expiry' ? 'orange' : 'red'}>
                    {filter === 'expiry' ? 'Caducidad' : 'Agotamiento'}
                  </Badge>
                )}
              </Group>
            </Table.Td>
            <Table.Td></Table.Td>
            <Table.Td><Badge size="xs" variant="light">{lot.quantity}</Badge></Table.Td>
            <Table.Td>
              {lot.daily_dose
                ? `${lot.daily_dose}/día${lot.treatment_days ? ` × ${lot.treatment_days}d` : ''}${lot.effective_quantity != null && lot.effective_quantity !== lot.quantity ? ` (quedan ${lot.effective_quantity})` : ''}`
                : '—'}
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => openEditLotModal(med, lot)}>
                  <IconEdit size={14} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteLot(lot.id)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>,
        )
      })
    return rows
  })

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="xl">Inventario</Text>
        <Select
          size="xs"
          w={220}
          value={filter === 'all' ? 'all' : filter}
          onChange={(v) => setFilter((v as FilterType) ?? 'all')}
          data={[
            { value: 'all', label: 'Todos los lotes' },
            { value: 'expiry', label: `Alertas de caducidad (${alerts?.expiry.length ?? 0})` },
            { value: 'depletion', label: `Alertas de agotamiento (${alerts?.depletion.length ?? 0})` },
          ]}
        />
      </Group>
      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Medicamento</Table.Th>
              <Table.Th>Laboratorio</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Lotes</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Box>
      {visibleInventory.length === 0 && (
        <Text c="dimmed" ta="center">
          {filter === 'all' ? 'Sin medicamentos. Usa la búsqueda para añadir.' : 'Ningún lote con esta alerta.'}
        </Text>
      )}

      <Modal
        opened={!!modalMed}
        onClose={closeLotModal}
        title={
          <Group gap="xs">
            <IconPlus size={18} color="#0CA678" />
            <Text fw={600}>{editingLot ? 'Editar lote' : 'Añadir lote'}</Text>
          </Group>
        }
      >
        <Stack>
          <Text size="sm" c="dimmed">{modalMed?.name ?? ''}</Text>
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
          <TextInput
            label="Duración del tratamiento (días)"
            placeholder="5"
            value={lotForm.treatment_days}
            onChange={(e) => setLotForm({ ...lotForm, treatment_days: e.target.value })}
          />
          <DateInput
            label="Fecha de inicio de la toma"
            placeholder="Cuándo empezaste a tomarlo"
            valueFormat="DD/MM/YYYY"
            value={lotForm.dose_start_date}
            onChange={(v) => setLotForm({ ...lotForm, dose_start_date: v })}
            clearable
          />
          <Button color="teal" loading={createLot.isPending || updateLot.isPending} onClick={handleSaveLot}>
            {editingLot ? 'Guardar cambios' : 'Guardar lote'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
