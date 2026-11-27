import { useEffect, useRef, useState } from 'react'
import { Modal, Stack, Text, Button, Group, Loader } from '@mantine/core'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { IconCameraOff } from '@tabler/icons-react'

interface BarcodeScannerModalProps {
  opened: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScannerModal({ opened, onClose, onScan }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!opened) return

    let cancelled = false
    setError(null)
    setScanning(true)

    // Secure context check — getUserMedia requires HTTPS or localhost
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Se requiere conexión HTTPS para usar la cámara. Si estás en desarrollo, usa localhost.')
      setScanning(false)
      return
    }

    const reader = new BrowserMultiFormatReader()

    /** Map a camera error to a user-friendly Spanish message. */
    function classifyCameraError(e: unknown): string {
      if (e instanceof DOMException) {
        switch (e.name) {
          case 'NotAllowedError':
            return 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
          case 'NotFoundError':
            return 'No se encontró ninguna cámara en este dispositivo.'
          case 'NotReadableError':
            return 'La cámara está siendo usada por otra aplicación.'
          default:
            return e.message || 'No se pudo acceder a la cámara'
        }
      }
      return e instanceof Error ? e.message : 'No se pudo acceder a la cámara'
    }

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (cancelled) return
        if (result) {
          const text = result.getText()
          if (text) {
            controlsRef.current?.stop()
            controlsRef.current = null
            setScanning(false)
            onScan(text)
          }
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(classifyCameraError(e))
          setScanning(false)
        }
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [opened, onScan])

  const handleClose = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Escanear código de barras" centered size="sm">
      <Stack gap="md" align="center">
        {error ? (
          <>
            <IconCameraOff size={48} color="var(--mantine-color-red-6)" />
            <Text size="sm" c="red" ta="center">{error}</Text>
            <Text size="xs" c="dimmed" ta="center">
              Asegúrate de permitir el acceso a la cámara en tu navegador.
              También puedes escribir el código manualmente.
            </Text>
          </>
        ) : (
          <>
            <div style={{ position: 'relative', width: '100%', maxWidth: 350 }}>
              <video
                ref={videoRef}
                style={{ width: '100%', borderRadius: 8, display: scanning ? 'block' : 'none' }}
              />
              {!scanning && (
                <Group justify="center" py="xl">
                  <Loader />
                </Group>
              )}
            </div>
            <Text size="xs" c="dimmed" ta="center">
              Enfoca el código de barras del medicamento
            </Text>
          </>
        )}
        <Button variant="light" onClick={handleClose}>Cerrar</Button>
      </Stack>
    </Modal>
  )
}
