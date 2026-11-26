import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Title, useTheme, Paragraph } from 'react-native-paper';
import { useMutation } from '@tanstack/react-query';
import { apiFetch, setTokens } from '@/api/client';
import type { TokenResponse } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { BrandColors } from '@/constants/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'login') {
        return apiFetch<TokenResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      } else if (mode === 'register') {
        return apiFetch<TokenResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, name, password }),
        })
      } else {
        // reset flow handled by separate mutations
        return null
      }
    },
    onSuccess: (tokens) => {
      if (tokens) {
        setTokens(tokens)
        login(tokens)
      }
    },
    onError: (err) => setError(String(err.message)),
  })

  const resetRequestMutation = useMutation({
    mutationFn: () => apiFetch<{ message: string; dev_token?: string }>('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    onSuccess: () => setResetSent(true),
    onError: (err) => setError(String(err.message)),
  })

  const resetConfirmMutation = useMutation({
    mutationFn: () => apiFetch<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, new_password: newPassword }),
    }),
    onSuccess: () => {
      setResetDone(true)
      setTimeout(() => {
        setMode('login')
        setResetSent(false)
        setResetDone(false)
        setResetToken('')
        setNewPassword('')
      }, 2000)
    },
    onError: (err) => setError(String(err.message)),
  })

  const handleSubmit = () => {
    setError('')
    if (mode === 'reset') {
      if (!resetSent) {
        resetRequestMutation.mutate()
      } else if (!resetDone) {
        resetConfirmMutation.mutate()
      }
    } else {
      mutation.mutate()
    }
  }

  const isLoading = mutation.isPending || resetRequestMutation.isPending || resetConfirmMutation.isPending

  const getTitle = () => {
    if (mode === 'login') return 'Inicia sesión'
    if (mode === 'register') return 'Crea tu cuenta'
    return 'Recuperar contraseña'
  }

  const getButtonText = () => {
    if (mode === 'login') return 'Entrar'
    if (mode === 'register') return 'Crear cuenta'
    if (resetDone) return 'Contraseña actualizada'
    if (resetSent) return 'Cambiar contraseña'
    return 'Enviar enlace'
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          <Title style={styles.title}>Apotheca</Title>
          <Text style={styles.subtitle}>{getTitle()}</Text>

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

          {mode !== 'reset' && (
            <TextInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
            />
          )}

          {mode === 'reset' && resetSent && !resetDone && (
            <>
              <Paragraph style={styles.resetInfo}>
                Si el email está registrado, se ha enviado un código de recuperación.
                Introdúcelo abajo con tu nueva contraseña.
              </Paragraph>
              <TextInput
                label="Código de recuperación"
                value={resetToken}
                onChangeText={setResetToken}
                mode="outlined"
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                label="Nueva contraseña (mín. 8 caracteres)"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={styles.input}
              />
            </>
          )}

          {mode === 'reset' && resetDone && (
            <Paragraph style={styles.resetDone}>¡Contraseña actualizada! Redirigiendo al login…</Paragraph>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={mode === 'reset' && resetDone}
            style={styles.button}
            buttonColor={BrandColors.primary}
          >
            {getButtonText()}
          </Button>

          {mode === 'reset' && resetSent && !resetDone && (
            <Button mode="text" onPress={() => { setResetSent(false); setError('') }}>
              Volver a intentar con otro email
            </Button>
          )}

          <Button
            mode="text"
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
              setResetSent(false)
              setResetDone(false)
            }}
          >
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Button>

          {mode === 'login' && (
            <Button
              mode="text"
              onPress={() => {
                setMode('reset')
                setError('')
                setResetSent(false)
                setResetDone(false)
              }}
              textColor={BrandColors.primary}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          )}

          {mode === 'reset' && (
            <Button mode="text" onPress={() => { setMode('login'); setError('') }}>
              Volver a inicio de sesión
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  form: { padding: 24 },
  title: { fontSize: 32, textAlign: 'center', color: BrandColors.primary, marginBottom: 4 },
  subtitle: { textAlign: 'center', marginBottom: 24, opacity: 0.6 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, paddingVertical: 4 },
  error: { color: BrandColors.danger, textAlign: 'center', marginBottom: 8 },
  resetInfo: { fontSize: 13, opacity: 0.6, marginBottom: 12, lineHeight: 18 },
  resetDone: { color: BrandColors.success, textAlign: 'center', marginBottom: 12 },
})
