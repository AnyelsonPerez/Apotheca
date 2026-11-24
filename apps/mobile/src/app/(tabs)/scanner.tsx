import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useObjectOutput } from 'react-native-vision-camera';
import type { ScannedCode } from 'react-native-vision-camera';
import { Card, Button, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Medication, CimaSearchResult } from '@/api/types';

export default function ScannerScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CimaSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const device = useCameraDevice('back');
  const qc = useQueryClient();
  const isScanningRef = useRef(false);

  const handleObjectsScanned = useCallback((objects: ScannedCode[]) => {
    if (isScanningRef.current) return;
    for (const obj of objects) {
      if (obj.value) {
        isScanningRef.current = true;
        const code = obj.value;
        setScannedCode(code);
        searchByBarcode(code);
        break;
      }
    }
  }, []);

  const objectOutput = useObjectOutput({
    types: ['ean-13', 'ean-8', 'qr', 'code-128', 'upc-e'],
    onObjectsScanned: handleObjectsScanned as any,
  });

  const searchByBarcode = async (barcode: string) => {
    setSearching(true);
    try {
      const results = await apiFetch<CimaSearchResult[]>(`/cima/search?nombre=${encodeURIComponent(barcode)}`);
      if (results.length > 0) {
        setSearchResult(results[0]);
      }
    } catch {
      setSearchResult(null);
    }
    setSearching(false);
  };

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      reset();
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
        <Button mode="contained" buttonColor="#0CA678" onPress={requestPermission}>
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
              <Paragraph style={styles.notFound}>No se encontró el medicamento en CIMA</Paragraph>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={reset}>Escanear otro</Button>
            {searchResult && (
              <Button
                mode="contained"
                buttonColor="#0CA678"
                loading={addMutation.isPending}
                onPress={() => addMutation.mutate(searchResult.nregistro)}
              >
                Añadir al inventario
              </Button>
            )}
          </Card.Actions>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <Camera
        device={device}
        isActive={true}
        outputs={[objectOutput]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Escanea el código de barras del medicamento</Text>
      </View>
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
    borderColor: '#0CA678',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 16, fontSize: 14 },
  resultContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  card: { marginBottom: 12 },
  code: { fontSize: 14, opacity: 0.6, marginTop: 4 },
  loader: { marginTop: 16 },
  resultInfo: { marginTop: 12 },
  medName: { fontSize: 16 },
  lab: { opacity: 0.6, marginTop: 4 },
  notFound: { color: '#F44336', marginTop: 8 },
});
