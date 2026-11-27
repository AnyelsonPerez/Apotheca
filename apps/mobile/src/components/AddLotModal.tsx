import { View, StyleSheet, Modal, Platform, ScrollView, Pressable } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, IconButton, Portal } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { apiFetch } from '@/api/client';
import type { Lot } from '@/api/types';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { BrandColors } from '@/constants/theme';

export interface AddLotModalProps {
  visible: boolean;
  medicationId: string | null;
  medicationName: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

export function AddLotModal({ visible, medicationId, medicationName, onClose, onCreated }: AddLotModalProps) {
  const qc = useQueryClient();
  const { toast, show, hide } = useToast();

  const [quantity, setQuantity] = useState('');
  const [dailyDose, setDailyDose] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleClose = useCallback(() => {
    setQuantity('');
    setDailyDose('');
    setExpiryDate(null);
    setShowDatePicker(false);
    onClose();
  }, [onClose]);

  const createLot = useMutation({
    mutationFn: (medId: string) =>
      apiFetch<Lot>('/inventory/lots', {
        method: 'POST',
        body: JSON.stringify({
          medication_id: medId,
          quantity: Number(quantity) || 0,
          daily_dose: dailyDose ? Number(dailyDose) : null,
          expiry_date: expiryDate ? expiryDate.toISOString() : null,
        }),
      }),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      show('Lote añadido correctamente');
      onCreated?.();
      handleClose();
    },
    onError: async (err) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      show(String(err.message), 'error');
    },
  });

  const handleSave = () => {
    if (!medicationId) return;
    createLot.mutate(medicationId);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Card>
                <Card.Content>
                  <Title>Añadir lote</Title>
                  <Paragraph numberOfLines={2} style={styles.modalMedName}>{medicationName}</Paragraph>
                  <TextInput
                    label="Cantidad"
                    value={quantity}
                    onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
                    mode="outlined"
                    keyboardType="numeric"
                    error={quantity !== '' && (Number(quantity) < 0 || !/^\d+$/.test(quantity))}
                    style={styles.input}
                  />
                  <TextInput
                    label="Dosis diaria (opcional)"
                    value={dailyDose}
                    onChangeText={(t) => setDailyDose(t.replace(/[^0-9.]/g, ''))}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="Ej: 2 (comprimidos al día)"
                    style={styles.input}
                  />
                  <View style={styles.dateRow}>
                    <Paragraph style={styles.dateLabel}>Caducidad:</Paragraph>
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
                    <View>
                      <RNDateTimePicker
                        value={expiryDate ?? new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        onChange={(_, date) => {
                          if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                          }
                          if (date) setExpiryDate(date);
                        }}
                      />
                      {Platform.OS === 'ios' && (
                        <View style={styles.datePickerActions}>
                          <Button onPress={() => setShowDatePicker(false)}>Hecho</Button>
                        </View>
                      )}
                    </View>
                  )}
                </Card.Content>
                <Card.Actions>
                  <Button onPress={handleClose}>Cancelar</Button>
                  <Button
                    mode="contained"
                    buttonColor={BrandColors.primary}
                    loading={createLot.isPending}
                    disabled={!quantity.trim() || Number(quantity) <= 0}
                    onPress={handleSave}
                  >
                    Guardar
                  </Button>
                </Card.Actions>
              </Card>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Portal>
        <ToastSnackbar toast={toast} onDismiss={hide} />
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { maxHeight: '80%' },
  modalScroll: { paddingBottom: 16 },
  modalMedName: { marginBottom: 12, opacity: 0.6 },
  input: { marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  dateLabel: { flex: 1, fontSize: 14 },
  dateButton: { flex: 1 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
});
