import { Card, Group, Stack, Text, Button, Alert, Code, Divider } from '@mantine/core'
import { IconDownload, IconInfoCircle, IconDeviceMobile } from '@tabler/icons-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

const APK_PATH = '/downloads/apotheca.apk'
const GITHUB_RELEASES = 'https://github.com/AnyelsonPerez/Apotheca/releases/tag/latest'

export function AppDownloadPage() {
  const [apkReady, setApkReady] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(APK_PATH, { method: 'HEAD' })
      .then((r) => setApkReady(r.ok && r.headers.get('content-length') !== '0'))
      .catch(() => setApkReady(false))
  }, [])

  const apkUrl = apkReady ? APK_PATH : GITHUB_RELEASES
  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${APK_PATH}`
    : APK_PATH

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
            target={apkReady ? undefined : '_blank'}
            rel={apkReady ? undefined : 'noopener noreferrer'}
            download={apkReady}
            leftSection={<IconDownload size={18} />}
            color="teal"
            loading={apkReady === null}
            mt="sm"
          >
            {apkReady === null
              ? 'Comprobando…'
              : apkReady
                ? 'Descargar APK'
                : 'Descargar desde GitHub'}
          </Button>
        </Stack>
      </Group>

      <Divider my="sm" />

      <Alert icon={<IconInfoCircle size={16} />} color="teal" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={600}>Configuración tras la instalación</Text>
          <Text size="xs" c="dimmed">
            Tras abrir la app por primera vez, ve a <b>Ajustes</b> e introduce la URL de tu API de Apotheca
            (por ejemplo: <Code>http://192.168.1.100</Code>).
          </Text>
        </Stack>
      </Alert>

      {apkReady === false && (
        <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
          <Text size="xs" c="dimmed">
            El APK aún no se ha descargado al servidor. Puedes descargarlo directamente desde
            GitHub Releases mientras tanto. Si acabas de instalar el servidor, ejecuta
            <Code>pct enter CT_ID</Code> y luego:
            <Code block>curl -fsSL -o /var/www/apotheca/downloads/apotheca.apk \
  https://github.com/AnyelsonPerez/Apotheca/releases/download/latest/apotheca.apk</Code>
          </Text>
        </Alert>
      )}
    </Stack>
  )
}
