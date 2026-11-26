import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, TextInput, Button, Paragraph } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiUrl, setApiUrl } from '@/api/client';
import type { Setting } from '@/api/types';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { ErrorView } from '@/components/ErrorView';
import { BrandColors } from '@/constants/theme';

const labels: Record<string, string> = {
  expiry_warning_days: 'Días de aviso de caducidad',
  depletion_threshold_days: 'Días de aviso de agotamiento',
  ntfy_topic: 'Topic de ntfy',
  ntfy_url: 'URL de ntfy',
};

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<Setting[]>('/settings'),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [apiUrl, setApiUrlState] = useState('');
  const [apiUrlError, setApiUrlError] = useState('');
  const [checkingUrl, setCheckingUrl] = useState(false);
  const { toast, show, hide } = useToast();
  const settingsKey = settings?.map((s) => `${s.key}:${s.value}`).join('|') ?? '';

  useEffect(() => {
    getApiUrl().then(setApiUrlState);
  }, []);

  const saveApiUrl = async () => {
    setApiUrlError('');
    setCheckingUrl(true);
    try {
      await setApiUrl(apiUrl);
      const base = await getApiUrl();
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error('El servidor respondió con error');
      const data = await res.json();
      if (data.status !== 'ok') throw new Error('El servidor no está sano');
      show('URL guardada y verificada correctamente');
      qc.invalidateQueries();
    } catch (err) {
      setApiUrlError(String(err instanceof Error ? err.message : err));
      show('Error al conectar con el servidor', 'error');
    } finally {
      setCheckingUrl(false);
    }
  };

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.key] = s.value; });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch<Setting>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      show('Configuración guardada');
    },
    onError: (err) => show(String(err.message), 'error'),
  });

  return (
    <>
      <ScrollView style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>URL de la API</Title>
            <TextInput
              label="URL del servidor (http://IP_O_HOST)"
              value={apiUrl}
              onChangeText={(t) => { setApiUrlState(t); setApiUrlError(''); }}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={!!apiUrlError}
              style={styles.input}
            />
            <Button
              mode="contained"
              buttonColor={BrandColors.primary}
              onPress={saveApiUrl}
              loading={checkingUrl}
              disabled={!apiUrl.trim() || apiUrl.trim() === ''}
              style={styles.input}
            >
              Guardar y verificar URL
            </Button>

            {apiUrlError.length > 0 && (
              <Paragraph style={styles.error}>{apiUrlError}</Paragraph>
            )}

            <Paragraph style={styles.help}>
              Introduce solo la IP o dominio de tu servidor (ej: http://192.168.50.8).
              La app añade /api automáticamente y verifica la conexión.
            </Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Ajustes</Title>
            {isLoading && <Paragraph style={styles.loading}>Cargando…</Paragraph>}
            {isError && !settings && (
              <ErrorView message="No se pudieron cargar los ajustes" onRetry={() => refetch()} />
            )}
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
                  buttonColor={BrandColors.primary}
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
      <ToastSnackbar toast={toast} onDismiss={hide} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 12 },
  row: { marginBottom: 12 },
  input: { marginBottom: 8 },
  error: { color: BrandColors.danger, marginTop: 4 },
  help: { textAlign: 'center', opacity: 0.5, fontSize: 12, marginTop: 16 },
  loading: { textAlign: 'center', opacity: 0.5, paddingVertical: 16 },
});
