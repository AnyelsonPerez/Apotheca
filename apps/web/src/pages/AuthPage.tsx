import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Card, Container, PasswordInput, Stack, TextInput, Title, Text, Anchor } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, useEffect } from 'react'
import { useLogin, useRegister } from '../api/hooks'
import { useAuth } from '../hooks/useAuth'
import { clearTokens } from '../api/client'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const { login } = useAuth()
  const loginMutation = useLogin()
  const registerMutation = useRegister()

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  // Clear any stale tokens from a previous session when entering auth page
  useEffect(() => {
    clearTokens()
  }, [])

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data, {
      onSuccess: (tokens) => {
        login({ id: '', email: data.email.toLowerCase(), name: '', is_admin: false }, tokens)
        notifications.show({ message: 'Bienvenido', color: 'green' })
      },
      onError: (err) => {
        const msg = String(err.message)
        if (msg.includes('Invalid email or password') || msg.includes('401')) {
          notifications.show({ message: 'Email o contraseña incorrectos. Si no tienes cuenta, regístrate.', color: 'red' })
        } else {
          notifications.show({ message: msg, color: 'red' })
        }
      },
    })
  }

  const onRegister = (data: RegisterForm) => {
    registerMutation.mutate(data, {
      onSuccess: (tokens) => {
        login({ id: '', email: data.email, name: data.name, is_admin: false }, tokens)
        notifications.show({ message: 'Cuenta creada', color: 'green' })
      },
      onError: (err) => {
        notifications.show({ message: String(err.message), color: 'red' })
      },
    })
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" c="teal.7">Apotheca</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
      </Text>

      <Card withBorder shadow="md" p={30} mt={20} radius="md">
        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="tu@email.com"
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />
              <PasswordInput
                label="Contraseña"
                placeholder="••••••••"
                error={loginForm.formState.errors.password?.message}
                {...loginForm.register('password')}
              />
              <Button type="submit" loading={loginMutation.isPending} color="teal">
                Entrar
              </Button>
            </Stack>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)}>
            <Stack>
              <TextInput
                label="Nombre"
                placeholder="Tu nombre"
                error={registerForm.formState.errors.name?.message}
                {...registerForm.register('name')}
              />
              <TextInput
                label="Email"
                placeholder="tu@email.com"
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />
              <PasswordInput
                label="Contraseña"
                placeholder="••••••••"
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register('password')}
              />
              <Button type="submit" loading={registerMutation.isPending} color="teal">
                Crear cuenta
              </Button>
            </Stack>
          </form>
        )}

        <Text ta="center" mt="md" size="sm">
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <Anchor size="sm" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </Anchor>
        </Text>
      </Card>
    </Container>
  )
}
