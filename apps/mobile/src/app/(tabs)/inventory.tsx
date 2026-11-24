import { View, FlatList, StyleSheet, Modal } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Chip, IconButton, FAB } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '@/api/client';
import type { InventoryItem, Lot } from '@/api/types';

export default function InventoryScreen() {
  const qc = useQueryClient();
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const [modalMed, setModalMed] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [dailyDose, setDailyDose] = useState('');
  const [dosage, setDosage] = useState('');

  const createLot = useMutation({
    mutationFn: () =>
      apiFetch<Lot>('/inventory/lots', {
        method: 'POST',
        body: JSON.stringify({
          medication_id: modalMed?.id,
          quantity: Number(quantity) || 0,
          daily_dose: dailyDose ? Number(dailyDose) : null,
          dosage: dosage || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setModalMed(null);
      setQuantity('');
      setDailyDose('');
      setDosage('');
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

  return (
    <View style={styles.container}>
      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={() => {}}
        ListEmptyComponent={<Paragraph style={styles.empty}>Sin medicamentos</Paragraph>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Title numberOfLines={2} style={styles.name}>{item.name}</Title>
                  <Paragraph numberOfLines={1}>{item.active_ingredient_name ?? '—'}</Paragraph>
                </View>
                <Chip mode="outlined">{item.total_quantity}</Chip>
                <IconButton icon="delete" iconColor="#F44336" onPress={() => deleteMed.mutate(item.id)} />
              </View>
              {item.lots.map((lot) => (
                <View key={lot.id} style={styles.lotRow}>
                  <Paragraph style={styles.lotText}>
                    Lote {lot.id.slice(0, 8)} — {lot.quantity} u
                    {lot.daily_dose ? ` — ${lot.daily_dose}/día` : ''}
                  </Paragraph>
                  <IconButton icon="delete-outline" size={18} iconColor="#F44336" onPress={() => deleteLot.mutate(lot.id)} />
                </View>
              ))}
            </Card.Content>
            <Card.Actions>
              <Button mode="contained-tonal" buttonColor="#0CA678" textColor="#fff" onPress={() => setModalMed(item)}>
                Añadir lote
              </Button>
            </Card.Actions>
          </Card>
        )}
      />

      <Modal visible={!!modalMed} animationType="slide" transparent onRequestClose={() => setModalMed(null)}>
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
                label="Dosis diaria"
                value={dailyDose}
                onChangeText={setDailyDose}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label="Posología"
                value={dosage}
                onChangeText={setDosage}
                mode="outlined"
                style={styles.input}
              />
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setModalMed(null)}>Cancelar</Button>
              <Button mode="contained" buttonColor="#0CA678" loading={createLot.isPending} onPress={() => createLot.mutate()}>
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
  lotText: { flex: 1, fontSize: 13, opacity: 0.7 },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.5 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { padding: 8 },
  modalMedName: { marginBottom: 12, opacity: 0.6 },
  input: { marginBottom: 8 },
});
