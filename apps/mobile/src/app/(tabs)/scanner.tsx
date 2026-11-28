import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { CameraView, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Card, Button, Title, Paragraph, ActivityIndicator, IconButton } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect, useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '@/api/client';
import type { Medication, CimaBarcodeResult } from '@/api/types';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { AddLotModal } from '@/components/AddLotModal';
import { BrandColors } from '@/constants/theme';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CimaBarcodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pendingMed, setPendingMed] = useState<Medication | null>(null);
  const qc = useQueryClient();
  const isScanningRef = useRef(false);
  const { toast, show, hide } = useToast();

  useFocusEffect(
    useCallback(() => {
      setScannedCode(null);
      setSearchResult(null);
      isScanningRef.current = false;
    }, []),
  );

  const searchByBarcode = async (barcode: string) => {
    setSearching(true);
    try {
      const result = await apiFetch<CimaBarcodeResult>(`/cima/barcode/${encodeURIComponent(barcode)}`);
      setSearchResult(result);
    } catch (err) {
      setSearchResult(null);
      if (String(err).includes('404')) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSearching(false);
    }
  };

  const cancelSearch = () => {
    setSearching(false);
    reset();
  };

  const onBarcodeScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (isScanningRef.current || !data) return;
    isScanningRef.current = true;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannedCode(data);
    // Brief delay so the user can see the scanned code before lookup
    setTimeout(() => {
      if (isScanningRef.current) {
        searchByBarcode(data);
      }
    }, 300);
  }, []);

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: async (med: Medication) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setPendingMed(med);  // Open the lot modal — don't call reset() yet
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

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted && !result.canAskAgain) {
      Alert.alert(
        'Permiso de cámara denegado',
        'Has denegado el permiso de cámara permanentemente. Habilítalo en los ajustes del sistema para usar el escáner.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  // Camera permissions are still loading.
  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          {permission.canAskAgain
            ? 'Se necesita permiso de cámara'
            : 'Permiso de cámara denegado. Habilítalo en los ajustes del sistema.'}
        </Text>
        <Button mode="contained" buttonColor={BrandColors.primary} onPress={handleRequestPermission}>
          {permission.canAskAgain ? 'Conceder permiso' : 'Abrir ajustes'}
        </Button>
        {!permission.canAskAgain && (
          <Button mode="text" textColor={BrandColors.primary} onPress={() => Linking.openSettings()}>
            Ir a ajustes del sistema
          </Button>
        )}
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
                {searchResult.in_inventory ? (
                  <View style={styles.inventoryBadge}>
                    <Text style={styles.inventoryBadgeText}>✓ En inventario · {searchResult.total_quantity} ud.</Text>
                  </View>
                ) : null}
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
            <Button onPress={() => searching ? cancelSearch() : reset()}>{searching ? 'Cancelar' : 'Escanear otro'}</Button>
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
        <AddLotModal
          visible={!!pendingMed}
          medicationId={pendingMed?.id ?? null}
          medicationName={pendingMed?.name ?? null}
          onClose={() => {
            setPendingMed(null);
            reset();
          }}
        />
        <ToastSnackbar toast={toast} onDismiss={hide} />
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {/* Unmount the camera when the tab loses focus — only one preview
          can be active at a time per Expo docs, and this also guarantees a
          fresh camera session when returning to this screen. */}
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          onBarcodeScanned={onBarcodeScanned}
          onMountError={({ message }) => show(message, 'error')}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'upc_e'],
          }}
        />
      )}
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
  inventoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  inventoryBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  lab: { opacity: 0.6, marginTop: 4 },
  notFound: { color: BrandColors.danger, marginTop: 8 },
  manualButton: { marginTop: 12 },
});
