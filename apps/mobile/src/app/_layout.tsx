import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === 'login';

  useEffect(() => {
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, inAuthGroup, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const paperTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <AuthGate>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
