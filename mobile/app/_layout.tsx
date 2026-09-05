import '../global.css';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useAuthStore, getStoredRefreshToken } from '../lib/authStore';
import { api } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';
import type { AuthUser } from '../lib/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/**
 * On cold start, the access token is gone (it only ever lived in memory).
 * If a refresh token exists in secure storage, silently exchange it for a
 * fresh access token before deciding where to route the user — this is
 * what makes "stay logged in" work across app restarts.
 */
function useSessionHydration() {
  const [isReady, setIsReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    (async () => {
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) {
        useAuthStore.setState({ isHydrating: false });
        setIsReady(true);
        return;
      }

      try {
        const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { refreshToken },
          { skipAuth: true }
        );
        await setSession(result.user, result.accessToken, result.refreshToken);
      } catch {
        // Stored refresh token is invalid/expired — fall through to the
        // logged-out state; clearSession also wipes the bad stored token.
        await useAuthStore.getState().clearSession();
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  return isReady;
}

import { registerForPushNotificationsAsync, useNotificationObserver } from '../lib/notifications';

function NotificationInitializer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useNotificationObserver();

  useEffect(() => {
    if (isAuthenticated) {
      void registerForPushNotificationsAsync();
    }
  }, [isAuthenticated]);

  return null;
}

export default function RootLayout() {
  const isReady = useSessionHydration();
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    void hydrateTheme().then((preference) => setColorScheme(preference));
  }, [hydrateTheme, setColorScheme]);

  if (!isReady || !themeHydrated) {
    return (
      <View className="flex-1 bg-white dark:bg-background items-center justify-center">
        <ActivityIndicator color="#FF7A00" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationInitializer />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colorScheme === 'dark' ? '#0A0A0A' : '#FFFFFF' },
          }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

