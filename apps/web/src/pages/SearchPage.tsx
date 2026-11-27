import { useEffect, useState } from 'react'
import { Badge, Button, Card, Group, Loader, Modal, NumberInput, Stack, Text, TextInput, ActionIcon, Tooltip } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { IconSearch, IconPlus, IconCheck, IconBarcode } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useAddMedication, useCimaDetail, useCimaSearch, useCimaBarcode, useCreateLot } from '../api/hooks'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import type { CimaSearchResult } from '../api/types'

/** Extract the unit count from a CIMA presentation name like "..., 20 sobres" */
function parsePresentationQty(nombre: string): number | null {
  const match = nombre.match(/,\s*(\d+)\s+/i)
  return match ? parseInt(match[1], 10) : null
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useCimaSearch(query)
  const addMedication = useAddMedication()
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedCn, setScannedCn] = useState<string | null>(null)
  const { data: barcodeResult, isError: barcodeError, error: barcodeErrMsg } = useCimaBarcode(scannedCn)

  // Lot modal state — the medication is only saved when the user hits "Guardar"
  const [lotModal, setLotModal] = useState<{ med: CimaSearchResult } | null>(null)
  const [lotForm, setLotForm] = useState({ quantity: 0, daily_dose: '', expiry_date: null as string | Date | null })
  const createLot = useCreateLot()
  const { data: cimaDetail, isFetching: detailLoading } = useCimaDetail(lotModal?.med.nregistro ?? null)

  // Pre-fill quantity from CIMA presentation when detail loads
  useEffect(() => {
    if (cimaDetail?.presentaciones && lotModal) {
      const commercial = cimaDetail.presentaciones.find((p) => p.comerc) ?? cimaDetail.presentaciones[0]
      if (commercial) {
        const qty = parsePresentationQty(commercial.nombre)
        if (qty != null) {
          setLotForm((prev) => ({ ...prev, quantity: qty }))
        }
      }
    }
  }, [cimaDetail, lotModal])

  // Handle barcode scan result
  useEffect(() => {
    if (!scannedCn) return
    if (barcodeResult) {
      // Found medication via barcode — open the lot modal directly
      setLotModal({
        med: {
          nregistro: barcodeResult.nregistro,
          nombre: barcodeResult.nombre,
          pactivos: barcodeResult.pactivos,
          labtitular: barcodeResult.labtitular,
          dosis: barcodeResult.dosis,
          cpresc: barcodeResult.cpresc,
        },
      })
      setLotForm({ quantity: 0, daily_dose: '', expiry_date: null })
      setScannedCn(null)
      setScannerOpen(false)
    } else if (barcodeError) {
      notifications.show({
        message: `No se encontró el medicamento en CIMA: ${barcodeErrMsg instanceof Error ? barcodeErrMsg.message : 'CN no encontrado'}`,
        color: 'red',
      })
      setScannedCn(null)
    }
  }, [scannedCn, barcodeResult, barcodeError, barcodeErrMsg])

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
      <Group gap="xs" align="flex-end">
        <TextInput
          placeholder="Busca por nombre o principio activo…"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <Tooltip label="Escanear código de barras">
          <ActionIcon
            variant="light"
            color="teal"
            size="lg"
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear código de barras"
          >
            <IconBarcode size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <BarcodeScannerModal
        opened={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => setScannedCn(code)}
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
            rightSection={detailLoading ? <Loader size="xs" /> : null}
            rightSectionWidth={28}
          />
          {detailLoading && (
            <Text size="xs" c="dimmed">Consultando presentaciones de CIMA…</Text>
          )}
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
