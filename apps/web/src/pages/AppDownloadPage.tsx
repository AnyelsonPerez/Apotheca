import { Card, Group, Stack, Text, Button, Alert, Code, Divider } from '@mantine/core'
import { IconDownload, IconInfoCircle, IconDeviceMobile } from '@tabler/icons-react'
import { QRCodeSVG } from 'qrcode.react'

export function AppDownloadPage() {
  // The APK download URL (relative — served by the web app or a static path)
  const apkUrl = '/downloads/apotheca.apk'
  // The full URL for the QR code (so mobile can scan and download)
  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}${apkUrl}` : apkUrl

  return (
    <Stack>
      <Group gap="xs" align="center">
        <IconDeviceMobile size={28} color="#0CA678" />
        <Text fw={700} size="xl">Descargar app Android</Text>
      </Group>

      <Text c="dimmed" size="sm">
        Escanea el código QR con tu móvil para descargar e instalar la app de Apotheca.
      </Text>

      <Group align="flex-start" gap="xl" wrap="nowrap">
        <Card withBorder p="lg" style={{ textAlign: 'center' }}>
          <Stack align="center" gap="xs">
            <QRCodeSVG value={qrUrl} size={200} />
            <Text size="xs" c="dimmed">Escanea para descargar</Text>
          </Stack>
        </Card>

        <Stack gap="xs">
          <Text fw={600} size="sm">Instrucciones</Text>
          <Text size="xs" c="dimmed">
            1. Escanea el QR con la cámara de tu móvil<br />
            2. Descarga el archivo APK<br />
            3. Permite instalar apps de orígenes desconocidos<br />
            4. Abre Apotheca y configura la URL de tu API en Ajustes
          </Text>

          <Button
            component="a"
            href={apkUrl}
            download
            leftSection={<IconDownload size={18} />}
            color="teal"
            mt="sm"
          >
            Descargar APK
          </Button>
        </Stack>
      </Group>

      <Divider my="sm" />

      <Alert icon={<IconInfoCircle size={16} />} color="teal" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={600}>Configuración tras la instalación</Text>
          <Text size="xs" c="dimmed">
            Tras abrir la app por primera vez, ve a <b>Ajustes</b> e introduce la URL de tu API de Apotheca
            (por ejemplo: <Code>http://192.168.1.100:8000</Code>).
          </Text>
        </Stack>
      </Alert>

      <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
        <Text size="xs" c="dimmed">
          Si el APK no está disponible todavía, el build de CI aún no ha generado el artefacto.
          Una vez que se complete el workflow de release, el APK se servirá desde esta ruta automáticamente.
        </Text>
      </Alert>
    </Stack>
  )
}
