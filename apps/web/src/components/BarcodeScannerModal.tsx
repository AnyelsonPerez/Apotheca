import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionIcon, Button, Group, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconArrowBackUp,
  IconBulb,
  IconBulbOff,
  IconCameraOff,
  IconCameraRotate,
} from '@tabler/icons-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

interface BarcodeScannerModalProps {
  opened: boolean
  onClose: () => void
  /** Submit a scanned code. Resolve true on success (modal can close);
   * resolve false or reject on failure (scanner will restart the camera). */
  onScan: (barcode: string) => Promise<boolean>
}

type ScannerPhase =
  | 'starting'
  | 'scanning'
  | 'denied'
  | 'no-camera'
  | 'insecure'
  | 'error'

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

/** Short beep via WebAudio — no audio assets needed. */
function playBeep(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 1050
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => void ctx.close()
  } catch {
    // Audio is a nice-to-have; ignore failures.
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not all platforms support it.
  }
}

/** Map a camera error to a user-friendly Spanish message plus a UI phase. */
function classifyCameraError(e: unknown): { message: string; phase: ScannerPhase } {
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'NotAllowedError':
        return {
          message:
            'Permiso de cámara denegado. Habilítalo en la configuración del navegador (icono de candado o cámara en la barra de direcciones) y vuelve a intentarlo.',
          phase: 'denied',
        }
      case 'NotFoundError':
        return { message: 'No se encontró ninguna cámara en este dispositivo.', phase: 'no-camera' }
      case 'NotReadableError':
        return {
          message: 'La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentarlo.',
          phase: 'error',
        }
      default:
        return { message: e.message || 'No se pudo acceder a la cámara', phase: 'error' }
    }
  }
  return { message: e instanceof Error ? e.message : 'No se pudo acceder a la cámara', phase: 'error' }
}

/**
 * Webcam barcode scanner for the medication lookup flow.
 *
 * Owns its getUserMedia lifecycle so React StrictMode re-runs and parent
 * re-renders cannot orphan a live stream: every track is stopped
 * synchronously in the effect cleanup, and the scan callback is kept in a
 * ref so the camera effect only depends on `opened`.
 *
 * Decoding prefers the native BarcodeDetector (fast on Android Chrome) and
 * falls back to ZXing canvas sampling (iOS Safari, Firefox).
 */
export function BarcodeScannerModal({ opened, onClose, onScan }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onScanRef = useRef(onScan)
  const scanningLockRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)
  const vfcIdRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)
  // Per-invocation race token: only the latest camera start may attach.
  const runIdRef = useRef(0)
  const acceptTimerRef = useRef<number | null>(null)

  const [phase, setPhase] = useState<ScannerPhase>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [scannedPreview, setScannedPreview] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [manualCode, setManualCode] = useState('')
  // Bumped to re-run the camera effect after a failed lookup.
  const [scanRetryTick, setScanRetryTick] = useState(0)

  const isMobile = useMediaQuery('(max-width: 620px)')

  // Keep the latest scan callback without re-running the camera effect.
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  /** Stop every live resource the scanner owns. Synchronous by design. */
  const stopEverything = useCallback(() => {
    cancelledRef.current = true
    // Invalidate every in-flight start and any pending accepted code.
    runIdRef.current += 1
    if (acceptTimerRef.current != null) {
      clearTimeout(acceptTimerRef.current)
      acceptTimerRef.current = null
    }
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (vfcIdRef.current != null) {
      const video = videoRef.current
      video?.cancelVideoFrameCallback?.(vfcIdRef.current)
      vfcIdRef.current = null
    }
    controlsRef.current?.stop()
    controlsRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  /** Accept a successfully decoded barcode exactly once per scan session.
   * The camera is only torn down if the parent reports success; on failure
   * the scanRetryTick bump makes the camera effect restart the stream. */
  const acceptCode = useCallback(
    (code: string) => {
      if (scanningLockRef.current) return
      scanningLockRef.current = true
      const runId = runIdRef.current
      playBeep()
      vibrate(120)
      setScannedPreview(code)
      acceptTimerRef.current = window.setTimeout(async () => {
        acceptTimerRef.current = null
        if (runId !== runIdRef.current) return
        let ok = false
        try {
          ok = await onScanRef.current(code)
        } catch {
          ok = false
        }
        if (runId !== runIdRef.current) return
        if (ok) {
          stopEverything()
        } else {
          // Lookup failed: tear down; the tick bump restarts the stream.
          stopEverything()
          setScanRetryTick((t) => t + 1)
        }
      }, 350)
    },
    [stopEverything],
  )

  /** Schedule the next detect on the freshest video frame available. */
  const scheduleNext = useCallback((video: HTMLVideoElement, detect: () => void) => {
    const frameCb = (
      video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    ).requestVideoFrameCallback
    if (typeof frameCb === 'function') {
      vfcIdRef.current = frameCb.call(video, () => {
        vfcIdRef.current = null
        detect()
      })
    } else {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        detect()
      })
    }
  }, [])

  /** ZXing fallback for browsers without BarcodeDetector. */
  const startZxingFallback = useCallback(
    (video: HTMLVideoElement) => {
      const reader = new BrowserMultiFormatReader()
      reader
        .decodeFromVideoElement(video, (result) => {
          if (cancelledRef.current) return
          const text = result?.getText()
          if (text) acceptCode(text)
        })
        .then((controls) => {
          if (cancelledRef.current) {
            controls.stop()
            return
          }
          controlsRef.current = controls
        })
        .catch(() => {
          if (!cancelledRef.current) {
            setErrorMsg('No se pudo iniciar el lector de códigos.')
            setPhase('error')
          }
        })
    },
    [acceptCode],
  )

  /** Native BarcodeDetector loop driven by requestVideoFrameCallback. */
  const detectWithNativeApi = useCallback(
    async (video: HTMLVideoElement) => {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Ctor) {
        startZxingFallback(video)
        return
      }
      let detector: BarcodeDetectorLike
      try {
        detector = new Ctor({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e'] })
      } catch {
        startZxingFallback(video)
        return
      }

      const detect = async () => {
        if (cancelledRef.current) return
        try {
          const codes = await detector.detect(video)
          const value = codes.find((c) => c.rawValue)?.rawValue
          if (value) {
            acceptCode(value)
            return
          }
        } catch {
          // Detector can throw on stale frames; keep scanning.
        }
        scheduleNext(video, () => void detect())
      }
      scheduleNext(video, () => void detect())
    },
    [acceptCode, scheduleNext, startZxingFallback],
  )

  /** Pick the decode strategy for this browser. */
  const startDecoding = useCallback(
    (video: HTMLVideoElement) => {
      if ('BarcodeDetector' in window) {
        void detectWithNativeApi(video)
      } else {
        startZxingFallback(video)
      }
    },
    [detectWithNativeApi, startZxingFallback],
  )

  /** Attach a stream to the video element and start decoding. Stops any
   * previous stream first so overlapping starts can never orphan a track. */
  const attachStream = useCallback(
    async (stream: MediaStream, runId: number) => {
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      video.srcObject = stream
      video.muted = true
      try {
        await video.play()
      } catch {
        // Autoplay can race with element mount; retry once.
        try {
          await video.play()
        } catch {
          /* keep the stream; decoding still works on queued frames */
        }
      }
      if (runId !== runIdRef.current) return

      const track = stream.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
      setTorchAvailable(!!caps?.torch)
      setPhase('scanning')
      startDecoding(video)
    },
    [startDecoding],
  )

  /** Acquire a fresh camera run. The runId token makes overlapping calls
   * safe: only the latest invocation is allowed to attach its stream. */
  const acquireCamera = useCallback(
    async (constraints: MediaStreamConstraints) => {
      const runId = runIdRef.current
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }
      await attachStream(stream, runId)
    },
    [attachStream],
  )

  /** Start the camera stream with the environment camera preferred. */
  const startCamera = useCallback(async () => {
    stopEverything()
    cancelledRef.current = false
    const runId = runIdRef.current
    setPhase('starting')
    setErrorMsg('')
    setScannedPreview(null)
    setTorchOn(false)
    scanningLockRef.current = false

    // Secure context check — getUserMedia requires HTTPS or localhost.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setPhase('insecure')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('insecure')
      return
    }

    try {
      try {
        await acquireCamera({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch (e) {
        // OverconstrainedError — retry with the bare minimum.
        if (runId !== runIdRef.current) return
        if (e instanceof DOMException && e.name === 'OverconstrainedError') {
          await acquireCamera({ video: true, audio: false })
        } else {
          throw e
        }
      }
    } catch (e) {
      // A superseded run's failure must not clobber the newest run's state.
      if (runId !== runIdRef.current) return
      const { message, phase: errPhase } = classifyCameraError(e)
      setErrorMsg(message)
      setPhase(errPhase)
    }
  }, [acquireCamera, stopEverything])

  // Camera lifecycle: tied to `opened` plus the retry tick — a failed
  // lookup bumps the tick to restart the stream in place.
  useEffect(() => {
    if (!opened) {
      stopEverything()
      return
    }
    void startCamera()
    return stopEverything
  }, [opened, scanRetryTick, startCamera, stopEverything])

  const handleClose = () => {
    stopEverything()
    onClose()
  }

  const handleRetry = () => {
    void startCamera()
  }

  const handleTorchToggle = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[],
      })
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  const handleFlipCamera = async () => {
    const devices = (await navigator.mediaDevices?.enumerateDevices()) ?? []
    const videoInputs = devices.filter((d) => d.kind === 'videoinput')
    if (videoInputs.length < 2) return
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId
    const next = videoInputs.find((d) => d.deviceId !== current)
    if (!next?.deviceId) return
    stopEverything()
    cancelledRef.current = false
    const runId = runIdRef.current
    setTorchOn(false)
    setScannedPreview(null)
    scanningLockRef.current = false
    setPhase('starting')
    try {
      await acquireCamera({
        video: { deviceId: { exact: next.deviceId } },
        audio: false,
      })
    } catch (e) {
      // A superseded flip's failure must not clobber the newest run's state.
      if (runId !== runIdRef.current) return
      const { message, phase: errPhase } = classifyCameraError(e)
      setErrorMsg(message)
      setPhase(errPhase)
    }
  }

  const handleSubmitManual = async () => {
    if (scanningLockRef.current) return
    const code = manualCode.trim()
    if (!code) return
    const digits = code.replace(/\D/g, '')
    if (digits.length < 6) {
      notifications.show({ message: 'El código debe tener al menos 6 dígitos', color: 'red' })
      return
    }
    scanningLockRef.current = true
    let ok = false
    try {
      ok = await onScanRef.current(digits)
    } catch {
      ok = false
    }
    if (ok) {
      stopEverything()
    } else if (phase === 'scanning') {
      // Manual lookup failed with a live camera: restart it for another try.
      stopEverything()
      setScanRetryTick((t) => t + 1)
    }
    scanningLockRef.current = false
  }

  const showVideo = phase === 'scanning'

  const renderError = (message: string, showRetry: boolean) => (
    <Stack gap="sm" align="center" py="xl">
      <IconCameraOff size={48} color="var(--mantine-color-red-6)" />
      <Text size="sm" c="red" ta="center">
        {message}
      </Text>
      {showRetry && <Button variant="light" onClick={handleRetry}>Reintentar</Button>}
    </Stack>
  )

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isMobile ? null : 'Escanear código de barras'}
      centered={!isMobile}
      fullScreen={isMobile}
      withCloseButton={false}
      padding={isMobile ? 0 : 'md'}
    >
      <Stack gap="sm" align="center">
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: isMobile ? undefined : 420,
            aspectRatio: isMobile ? undefined : '3 / 4',
            height: isMobile ? '100%' : undefined,
            backgroundColor: '#000',
            borderRadius: isMobile ? 0 : 12,
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: showVideo ? 'block' : 'none',
            }}
          />
          {/* Darkened mask with a cut-out scan window */}
          {showVideo && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '78%',
                  aspectRatio: '4 / 3',
                  borderRadius: 12,
                  boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.45)',
                  border: scannedPreview ? '2px solid #12b886' : '2px solid rgba(255,255,255,0.85)',
                }}
              />
              <Text
                c="white"
                size="sm"
                ta="center"
                style={{ position: 'absolute', bottom: 16, left: 0, right: 0 }}
              >
                {scannedPreview ? `Código: ${scannedPreview}` : 'Escanea el código de barras del medicamento'}
              </Text>
            </div>
          )}
          {phase === 'starting' && (
            <Group justify="center" h="100%" align="center">
              <Text c="dimmed" size="sm">
                Iniciando cámara…
              </Text>
            </Group>
          )}
          {phase === 'denied' && renderError(errorMsg, true)}
          {phase === 'no-camera' && renderError(errorMsg, false)}
          {phase === 'insecure' &&
            renderError(
              'Se requiere conexión HTTPS para usar la cámara. Abre la web mediante HTTPS (o localhost en desarrollo).',
              false,
            )}
          {phase === 'error' && renderError(errorMsg, true)}

          {/* Camera controls overlay */}
          {showVideo && (
            <Group
              justify="center"
              gap="lg"
              style={{ position: 'absolute', bottom: 60, left: 0, right: 0 }}
            >
              {torchAvailable && (
                <Tooltip label={torchOn ? 'Apagar linterna' : 'Encender linterna'}>
                  <ActionIcon
                    variant={torchOn ? 'filled' : 'light'}
                    color="teal"
                    size="lg"
                    onClick={() => void handleTorchToggle()}
                    aria-label="Alternar linterna"
                  >
                    {torchOn ? <IconBulb size={20} /> : <IconBulbOff size={20} />}
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Cambiar cámara">
                <ActionIcon
                  variant="light"
                  color="teal"
                  size="lg"
                  onClick={() => void handleFlipCamera()}
                  aria-label="Cambiar cámara"
                >
                  <IconCameraRotate size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </div>

        {/* Manual entry fallback */}
        <Group gap="xs" w="100%" grow>
          <TextInput
            placeholder="Escribe el código manualmente (CN)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitManual()
            }}
            leftSection={<IconArrowBackUp size={16} style={{ transform: 'rotate(90deg)' }} />}
          />
          <Button variant="light" onClick={handleSubmitManual}>
            Buscar
          </Button>
        </Group>

        <Button variant="subtle" onClick={handleClose} fullWidth>
          Cerrar
        </Button>
      </Stack>
    </Modal>
  )
}
