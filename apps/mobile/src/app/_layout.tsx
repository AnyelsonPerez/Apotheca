import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { hasServerUrl } from '@/api/client';
import { BrandColors } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    hasServerUrl().then(setServerConfigured);
  }, []);

  const inAuthGroup = segments[0] === 'login';
  const inSetup = segments[0] === 'setup';

  const isReady = serverConfigured !== null && !isAuthLoading;

  useEffect(() => {
    if (!isReady) return;

    if (!serverConfigured && !inSetup) {
      router.replace('/setup');
      return;
    }

    if (!isAuthenticated && !inAuthGroup && !inSetup) {
      router.replace('/login');
    } else if (isAuthenticated && (inAuthGroup || inSetup)) {
      router.replace('/');
    }
  }, [isAuthenticated, isAuthLoading, inAuthGroup, inSetup, serverConfigured, isReady, router]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

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
              <Stack.Screen name="setup" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
