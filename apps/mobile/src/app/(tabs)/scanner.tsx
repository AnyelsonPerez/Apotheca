import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { Card, Button, Title, Paragraph, ActivityIndicator, IconButton } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import type { Medication, CimaBarcodeResult } from '@/api/types';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { BrandColors } from '@/constants/theme';

export default function ScannerScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const router = useRouter();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CimaBarcodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const device = useCameraDevice('back');
  const qc = useQueryClient();
  const isScanningRef = useRef(false);
  const { toast, show, hide } = useToast();

  const searchByBarcode = async (barcode: string) => {
    setSearching(true);
    try {
      const result = await apiFetch<CimaBarcodeResult>(`/cima/barcode/${encodeURIComponent(barcode)}`);
      setSearchResult(result);
    } catch {
      setSearchResult(null);
    }
    setSearching(false);
  };

  const onCodeScanned = useCallback(async (codes: { value?: string }[]) => {
    if (isScanningRef.current) return;
    for (const code of codes) {
      if (code.value) {
        isScanningRef.current = true;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const value = code.value;
        setScannedCode(value);
        searchByBarcode(value);
        break;
      }
    }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'qr', 'code-128', 'upc-e'],
    onCodeScanned,
  });

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      show('Medicamento añadido al inventario');
      reset();
    },
    onError: async (err) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      show(String(err.message), 'error');
    },
  });

  const reset = () => {
    setScannedCode(null);
    setSearchResult(null);
    isScanningRef.current = false;
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Se necesita permiso de cámara</Text>
        <Button mode="contained" buttonColor={BrandColors.primary} onPress={requestPermission}>
          Conceder permiso
        </Button>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>Cargando cámara…</Text>
      </View>
    );
  }

  if (scannedCode) {
    return (
      <View style={styles.resultContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Resultado del escaneo</Title>
            <Paragraph style={styles.code}>Código: {scannedCode}</Paragraph>
            {searching && <ActivityIndicator style={styles.loader} />}
            {searchResult && (
              <View style={styles.resultInfo}>
                <Title style={styles.medName}>{searchResult.nombre}</Title>
                <Paragraph>{searchResult.pactivos}</Paragraph>
                <Paragraph style={styles.lab}>{searchResult.labtitular}</Paragraph>
              </View>
            )}
            {!searching && !searchResult && (
              <View>
                <Paragraph style={styles.notFound}>No se encontró el medicamento en CIMA</Paragraph>
                <Button
                  mode="outlined"
                  textColor={BrandColors.primary}
                  onPress={() => { reset(); router.push('/(tabs)/search'); }}
                  style={styles.manualButton}
                >
                  Buscar manualmente
                </Button>
              </View>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={reset}>Escanear otro</Button>
            {searchResult && (
              <Button
                mode="contained"
                buttonColor={BrandColors.primary}
                loading={addMutation.isPending}
                onPress={() => addMutation.mutate(searchResult.nregistro)}
              >
                Añadir al inventario
              </Button>
            )}
          </Card.Actions>
        </Card>
        <ToastSnackbar toast={toast} onDismiss={hide} />
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <Camera
        device={device}
        isActive={true}
        torch={torchOn ? 'on' : 'off'}
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Escanea el código de barras del medicamento</Text>
      </View>
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.torchButton, torchOn && styles.torchButtonActive]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <IconButton
            icon={torchOn ? 'flashlight' : 'flashlight-off'}
            iconColor="#fff"
            size={24}
          />
          <Text style={styles.torchLabel}>{torchOn ? 'ON' : 'OFF'}</Text>
        </Pressable>
        <Pressable
          style={styles.manualSearchButton}
          onPress={() => router.push('/(tabs)/search')}
        >
          <IconButton icon="magnify" iconColor="#fff" size={22} />
          <Text style={styles.manualSearchLabel}>Búsqueda manual</Text>
        </Pressable>
      </View>
      <ToastSnackbar toast={toast} onDismiss={hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: { fontSize: 16, marginBottom: 16, textAlign: 'center', opacity: 0.7 },
  cameraContainer: { flex: 1, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: BrandColors.primary,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 16, fontSize: 14 },
  bottomBar: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  torchButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  torchButtonActive: { backgroundColor: BrandColors.primary },
  torchLabel: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  manualSearchButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualSearchLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginRight: 4 },
  resultContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  card: { marginBottom: 12 },
  code: { fontSize: 14, opacity: 0.6, marginTop: 4 },
  loader: { marginTop: 16 },
  resultInfo: { marginTop: 12 },
  medName: { fontSize: 16 },
  lab: { opacity: 0.6, marginTop: 4 },
  notFound: { color: BrandColors.danger, marginTop: 8 },
  manualButton: { marginTop: 12 },
});
