import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, TextInput, Button, Paragraph } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Setting } from '@/api/types';

const labels: Record<string, string> = {
  expiry_warning_days: 'Días de aviso de caducidad',
  depletion_threshold_days: 'Días de aviso de agotamiento',
  ntfy_topic: 'Topic de ntfy',
  ntfy_url: 'URL de ntfy',
};

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<Setting[]>('/settings'),
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.key] = s.value; });
      setValues(map);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch<Setting>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Ajustes</Title>
          {settings?.map((s) => (
            <View key={s.key} style={styles.row}>
              <TextInput
                label={labels[s.key] ?? s.key}
                value={values[s.key] ?? ''}
                onChangeText={(text) => setValues({ ...values, [s.key]: text })}
                mode="outlined"
                style={styles.input}
              />
              <Button
                mode="contained"
                buttonColor="#0CA678"
                onPress={() => updateMutation.mutate({ key: s.key, value: values[s.key] ?? '' })}
                loading={updateMutation.isPending}
              >
                Guardar
              </Button>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 12 },
  row: { marginBottom: 12 },
  input: { marginBottom: 8 },
});
