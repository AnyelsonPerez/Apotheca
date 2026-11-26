import { View, FlatList, StyleSheet, Modal, Alert, Platform } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Chip, IconButton } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { apiFetch } from '@/api/client';
import type { InventoryItem, Lot } from '@/api/types';
import { ErrorView } from '@/components/ErrorView';
import { BrandColors } from '@/constants/theme';

export default function InventoryScreen() {
  const qc = useQueryClient();
  const { data: inventory, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const [modalMed, setModalMed] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [dailyDose, setDailyDose] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const resetModal = () => {
    setModalMed(null);
    setQuantity('');
    setDailyDose('');
    setExpiryDate(null);
  };

  const createLot = useMutation({
    mutationFn: () =>
      apiFetch<Lot>('/inventory/lots', {
        method: 'POST',
        body: JSON.stringify({
          medication_id: modalMed?.id,
          quantity: Number(quantity) || 0,
          daily_dose: dailyDose ? Number(dailyDose) : null,
          expiry_date: expiryDate ? expiryDate.toISOString() : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      resetModal();
    },
  });

  const deleteMed = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/inventory/medications/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const deleteLot = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/inventory/lots/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const confirmDeleteMed = (id: string, name: string) => {
    Alert.alert(
      'Eliminar medicamento',
      `¿Eliminar "${name}" y todos sus lotes? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMed.mutate(id) },
      ],
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatExpiry = (lot: Lot) => {
    const formatted = formatDate(lot.expiry_date);
    if (!formatted) return null;
    const expiry = lot.expiry_date ? new Date(lot.expiry_date) : null;
    if (expiry) {
      const now = new Date();
      const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) return { text: `Caducado (${formatted})`, urgent: true };
      if (daysUntil <= 30) return { text: `Caduca ${formatted} (${daysUntil}d)`, warning: true };
    }
    return { text: `Caduca ${formatted}` };
  };

  if (isError && !inventory) {
    return <ErrorView message="No se pudo cargar el inventario" onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={() => {}}
        ListEmptyComponent={<Paragraph style={styles.empty}>Sin medicamentos. Usa Buscar o Escanear para añadir.</Paragraph>}
        renderItem={({ item, index: medIndex }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Title numberOfLines={2} style={styles.name}>{item.name}</Title>
                  <Paragraph numberOfLines={1}>{item.active_ingredient_name ?? '—'}</Paragraph>
                </View>
                <Chip mode="outlined">{item.total_quantity}</Chip>
                <IconButton icon="delete" iconColor={BrandColors.danger} onPress={() => confirmDeleteMed(item.id, item.name)} />
              </View>
              {item.lots.map((lot, lotIndex) => {
                const expiry = formatExpiry(lot);
                return (
                  <View key={lot.id} style={styles.lotRow}>
                    <View style={styles.lotInfo}>
                      <Paragraph style={styles.lotText}>
                        Lote #{lotIndex + 1} — {lot.quantity} u
                        {lot.daily_dose ? ` — ${lot.daily_dose}/día` : ''}
                      </Paragraph>
                      {expiry && (
                        <Paragraph style={[
                          styles.lotExpiry,
                          expiry.urgent && styles.lotExpiryUrgent,
                          expiry.warning && styles.lotExpiryWarning,
                        ]}>
                          {expiry.text}
                        </Paragraph>
                      )}
                    </View>
                    <IconButton
                      icon="delete-outline"
                      size={18}
                      iconColor={BrandColors.danger}
                      onPress={() => {
                        Alert.alert(
                          'Eliminar lote',
                          `¿Eliminar el lote #${lotIndex + 1} de "${item.name}"?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Eliminar', style: 'destructive', onPress: () => deleteLot.mutate(lot.id) },
                          ],
                        );
                      }}
                    />
                  </View>
                );
              })}
            </Card.Content>
            <Card.Actions>
              <Button mode="contained-tonal" buttonColor={BrandColors.primary} textColor="#fff" onPress={() => setModalMed(item)}>
                Añadir lote
              </Button>
            </Card.Actions>
          </Card>
        )}
      />

      <Modal visible={!!modalMed} animationType="slide" transparent onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Title>Añadir lote</Title>
              <Paragraph numberOfLines={2} style={styles.modalMedName}>{modalMed?.name}</Paragraph>
              <TextInput
                label="Cantidad"
                value={quantity}
                onChangeText={setQuantity}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label="Dosis diaria (opcional)"
                value={dailyDose}
                onChangeText={setDailyDose}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
              <View style={styles.dateRow}>
                <Paragraph style={styles.dateLabel}>Fecha de caducidad:</Paragraph>
                <Button
                  mode="outlined"
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateButton}
                >
                  {expiryDate
                    ? expiryDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Seleccionar'}
                </Button>
                {expiryDate && (
                  <IconButton icon="close" size={18} onPress={() => setExpiryDate(null)} />
                )}
              </View>
              {showDatePicker && (
                <RNDateTimePicker
                  value={expiryDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (date) setExpiryDate(date);
                    else if (Platform.OS === 'ios') setShowDatePicker(false);
                  }}
                />
              )}
            </Card.Content>
            <Card.Actions>
              <Button onPress={resetModal}>Cancelar</Button>
              <Button
                mode="contained"
                buttonColor={BrandColors.primary}
                loading={createLot.isPending}
                disabled={!quantity.trim()}
                onPress={() => createLot.mutate()}
              >
                Guardar
              </Button>
            </Card.Actions>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16 },
  lotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  lotInfo: { flex: 1 },
  lotText: { fontSize: 13, opacity: 0.7 },
  lotExpiry: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  lotExpiryUrgent: { color: BrandColors.danger, opacity: 1 },
  lotExpiryWarning: { color: BrandColors.warning, opacity: 1 },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.5 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { padding: 8 },
  modalMedName: { marginBottom: 12, opacity: 0.6 },
  input: { marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  dateLabel: { flex: 1, fontSize: 14 },
  dateButton: { flex: 1 },
});
