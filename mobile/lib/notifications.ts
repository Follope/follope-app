import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { api } from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register notification channels and request system permission.
 * Fetches the Expo push token and syncs it to the backend API.
 */
export async function registerForPushNotificationsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  token: string | null;
}> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', token: null };
  }

  // Set up Android notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF7A00',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Payment Reminders',
      description: 'Alerts for overdue invoices and client follow-ups',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF7A00',
      sound: 'default',
    });
  }

  // Check current permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return { status: finalStatus, token: null };
  }

  // Retrieve Expo Push Token
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;

    // Sync token to backend if logged in
    try {
      await api.post('/notifications/push-token', { pushToken: token });
    } catch {
      // Backend might be offline or user not logged in yet; will retry on next session
    }

    return { status: 'granted', token };
  } catch (err) {
    console.warn('[Notifications] Could not retrieve Expo push token (expected in bare emulator without Play Services):', err);
    return { status: 'granted', token: null };
  }
}

/**
 * Triggers an immediate local system tray / heads-up notification.
 * Works offline, in emulators, and without server credentials.
 */
export async function triggerLocalNotification({
  title,
  body,
  data = {},
  channelId = 'default',
}: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}) {
  if (Platform.OS === 'web') return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null, // deliver immediately
  });
}

/**
 * Hook to observe incoming notifications and user taps on notification banners,
 * navigating immediately to the appropriate screen.
 */
export function useNotificationObserver() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Check if app was opened from a cold start by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationNavigation(response);
      }
    });

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notification] Foreground notification received:', notification.request.content.title);
    });

    // User tapped notification banner
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationNavigation(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  function handleNotificationNavigation(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as Record<string, any> | undefined;
    if (!data) return;

    if (data.url && typeof data.url === 'string') {
      router.push(data.url as any);
    } else if (data.type === 'invoice_overdue' || data.screen === 'notifications') {
      router.push('/(main)/notifications' as any);
    } else if (data.invoiceId && typeof data.invoiceId === 'string') {
      router.push(`/(main)/invoices/${data.invoiceId}` as any);
    }
  }
}
