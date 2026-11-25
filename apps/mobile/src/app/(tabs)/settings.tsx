import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, TextInput, Button, Paragraph } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiUrl, setApiUrl } from '@/api/client';
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
  const [apiUrl, setApiUrlState] = useState('');

  useEffect(() => {
    getApiUrl().then(setApiUrlState);
  }, []);

  const [apiUrlError, setApiUrlError] = useState('');

  const saveApiUrl = async () => {
    try {
      await setApiUrl(apiUrl);
      setApiUrlError('');
    } catch (err) {
      setApiUrlError(String(err));
    }
  };

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
          <Title>URL de la API</Title>
          <TextInput
            label="URL del servidor (http://IP_O_HOST)"
            value={apiUrl}
            onChangeText={(t) => { setApiUrlState(t); setApiUrlError(''); }}
            mode="outlined"
            error={!!apiUrlError}
            style={styles.input}
          />
          <Button mode="contained" buttonColor="#0CA678" onPress={saveApiUrl} style={styles.input}>
            Guardar URL
          </Button>

          {apiUrlError.length > 0 && (
            <Paragraph style={{ color: '#F44336', marginTop: 4 }}>{apiUrlError}</Paragraph>
          )}

          <Paragraph style={{ marginTop: 16 }}>
            Introduce solo la IP o dominio de tu servidor (ej: http://192.168.50.8).
            La app añade /api automáticamente.
          </Paragraph>
        </Card.Content>
      </Card>

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
