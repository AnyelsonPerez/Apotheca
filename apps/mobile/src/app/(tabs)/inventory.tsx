import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, IconButton, Portal } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '@/api/client';
import type { InventoryItem, Lot } from '@/api/types';
import { ErrorView } from '@/components/ErrorView';
import { AddLotModal } from '@/components/AddLotModal';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { useToast } from '@/hooks/use-toast';
import { BrandColors } from '@/constants/theme';

export default function InventoryScreen() {
  const qc = useQueryClient();
  const { toast, show, hide } = useToast();
  const { data: inventory, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const [modalMed, setModalMed] = useState<InventoryItem | null>(null);

  const deleteMed = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/inventory/medications/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      show('Medicamento eliminado');
    },
  });

  const deleteLot = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/inventory/lots/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      show('Lote eliminado');
    },
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

  const sortedInventory = useMemo(() => {
    if (!inventory) return [];
    return [...inventory].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [inventory]);

  if (isError && !inventory) {
    return <ErrorView message="No se pudo cargar el inventario" onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedInventory}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={() => refetch()}
        ListEmptyComponent={<Paragraph style={styles.empty}>Sin medicamentos. Usa Buscar o Escanear para añadir.</Paragraph>}
        renderItem={({ item }) => (
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
                      {!expiry && (
                        <Paragraph style={styles.lotExpiry}>Sin fecha de caducidad</Paragraph>
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

      <AddLotModal
        visible={!!modalMed}
        medicationId={modalMed?.id ?? null}
        medicationName={modalMed?.name ?? null}
        onClose={() => setModalMed(null)}
      />

      <Portal>
        <ToastSnackbar toast={toast} onDismiss={hide} />
      </Portal>
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
});
