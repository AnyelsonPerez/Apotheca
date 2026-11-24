import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Title, useTheme } from 'react-native-paper';
import { useMutation } from '@tanstack/react-query';
import { apiFetch, setTokens } from '@/api/client';
import type { TokenResponse } from '@/api/types';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const body = mode === 'login'
        ? { email, password }
        : { email, name, password }
      return apiFetch<TokenResponse>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      )
    },
    onSuccess: (tokens) => {
      setTokens(tokens)
      login(tokens)
    },
    onError: (err) => setError(String(err.message)),
  })

  const handleSubmit = () => {
    setError('')
    mutation.mutate()
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.form}>
        <Title style={styles.title}>Apotheca</Title>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
        </Text>

        {mode === 'register' && (
          <TextInput
            label="Nombre"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
        )}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={styles.button}
          buttonColor="#0CA678"
        >
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>

        <Button
          mode="text"
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  form: { padding: 24 },
  title: { fontSize: 32, textAlign: 'center', color: '#0CA678', marginBottom: 4 },
  subtitle: { textAlign: 'center', marginBottom: 24, opacity: 0.6 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, paddingVertical: 4 },
  error: { color: '#F44336', textAlign: 'center', marginBottom: 8 },
})
