import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCreateLot, useDeleteLot, useDeleteMedication, useInventory } from '../api/hooks'
import type { InventoryItem } from '../api/types'

export function InventoryPage() {
  const { data: inventory, isLoading } = useInventory()
  const deleteMed = useDeleteMedication()
  const deleteLot = useDeleteLot()
  const createLot = useCreateLot()
  const [modalMed, setModalMed] = useState<InventoryItem | null>(null)
  const [lotForm, setLotForm] = useState({ quantity: 0, daily_dose: '', dosage: '' })

  const openLotModal = (med: InventoryItem) => {
    setModalMed(med)
    setLotForm({ quantity: 0, daily_dose: '', dosage: '' })
  }

  const handleCreateLot = () => {
    if (!modalMed) return
    createLot.mutate(
      {
        medication_id: modalMed.id,
        quantity: lotForm.quantity,
        daily_dose: lotForm.daily_dose ? Number(lotForm.daily_dose) : null,
        dosage: lotForm.dosage || null,
      },
      {
        onSuccess: () => {
          notifications.show({ message: 'Lote añadido', color: 'green' })
          setModalMed(null)
        },
        onError: (err) => notifications.show({ message: String(err.message), color: 'red' }),
      },
    )
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

  const rows = inventory?.flatMap((med) => {
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
    med.lots.forEach((lot) => {
      rows.push(
        <Table.Tr key={lot.id} bg="gray.0">
          <Table.Td pl="xl">
            <Text size="xs" c="dimmed">Lote: {lot.id.slice(0, 8)}</Text>
            {lot.dosage && <Text size="xs" c="dimmed">{lot.dosage}</Text>}
          </Table.Td>
          <Table.Td></Table.Td>
          <Table.Td><Badge size="xs" variant="light">{lot.quantity}</Badge></Table.Td>
          <Table.Td>{lot.daily_dose ? `${lot.daily_dose}/día` : '—'}</Table.Td>
          <Table.Td>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteLot(lot.id)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Table.Td>
        </Table.Tr>,
      )
    })
    return rows
  })

  return (
    <Stack>
      <Text fw={700} size="xl">Inventario</Text>
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
      {inventory?.length === 0 && <Text c="dimmed" ta="center">Sin medicamentos. Usa la búsqueda para añadir.</Text>}

      <Modal opened={!!modalMed} onClose={() => setModalMed(null)} title={`Añadir lote — ${modalMed?.name ?? ''}`}>
        <Stack>
          <NumberInput
            label="Cantidad"
            min={0}
            value={lotForm.quantity}
            onChange={(v) => setLotForm({ ...lotForm, quantity: Number(v) || 0 })}
          />
          <TextInput
            label="Dosis diaria"
            placeholder="2.5"
            value={lotForm.daily_dose}
            onChange={(e) => setLotForm({ ...lotForm, daily_dose: e.target.value })}
          />
          <TextInput
            label="Posología"
            placeholder="1 comprimido cada 8h"
            value={lotForm.dosage}
            onChange={(e) => setLotForm({ ...lotForm, dosage: e.target.value })}
          />
          <Button color="teal" loading={createLot.isPending} onClick={handleCreateLot}>
            Guardar lote
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
