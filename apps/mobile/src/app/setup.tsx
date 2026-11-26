import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Title, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getApiUrl, setApiUrl } from '@/api/client';
import { BrandColors } from '@/constants/theme';

export default function SetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSave = async () => {
    setError('');
    setChecking(true);
    try {
      await setApiUrl(url);
      const base = await getApiUrl();
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error('El servidor respondió con error');
      const data = await res.json();
      if (data.status !== 'ok') throw new Error('El servidor no está sano');
      // Navigate to login
      router.replace('/login');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.form}>
        <Title style={styles.title}>Apotheca</Title>
        <Text style={styles.subtitle}>Configura tu servidor</Text>

        <TextInput
          label="URL del servidor (http://IP_O_HOST)"
          value={url}
          onChangeText={(t) => { setUrl(t); setError(''); }}
          mode="outlined"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.50.9"
          style={styles.input}
          error={!!error}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={checking}
          disabled={!url.trim()}
          style={styles.button}
          buttonColor={BrandColors.primary}
        >
          Conectar
        </Button>

        <Text style={styles.help}>
          Introduce la IP o dominio de tu servidor Apotheca.
          La app añadirá /api automáticamente.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  form: { padding: 24 },
  title: { fontSize: 32, textAlign: 'center', color: BrandColors.primary, marginBottom: 4 },
  subtitle: { textAlign: 'center', marginBottom: 24, opacity: 0.6 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, paddingVertical: 4 },
  error: { color: BrandColors.danger, textAlign: 'center', marginBottom: 8 },
  help: { textAlign: 'center', opacity: 0.5, fontSize: 12, marginTop: 16 },
});