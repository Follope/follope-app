import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useThemeStore } from '../../../lib/themeStore';
import { useAuthStore, getStoredRefreshToken } from '../../../lib/authStore';
import { api } from '../../../lib/api';
import { confirmAction, showAlert } from '../../../lib/alert';
import { registerForPushNotificationsAsync, triggerLocalNotification } from '../../../lib/notifications';
import { useSendTestNotification } from '../../../lib/queries';

function SettingsRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between py-4 border-b border-neutral-200 dark:border-border"
    >
      <Text className="text-neutral-900 dark:text-white text-base">{label}</Text>
      <View className="flex-row items-center">
        {value ? <Text className="text-neutral-500 mr-2">{value}</Text> : null}
        {onPress ? <ChevronRight color="#6B6B6B" size={18} /> : null}
      </View>
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-neutral-500 text-xs font-medium uppercase mb-2 px-1">{title}</Text>
      <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl px-4">{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('Checking…');
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const themePreference = useThemeStore((state) => state.preference);
  const sendTestNotification = useSendTestNotification();

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifPermission(status === 'granted' ? 'Enabled' : 'Disabled');
    }).catch(() => {
      setNotifPermission('Unavailable');
    });
  }, []);

  const handleRequestPermission = async () => {
    const res = await registerForPushNotificationsAsync();
    setNotifPermission(res.status === 'granted' ? 'Enabled' : 'Denied');
    if (res.status === 'granted') {
      showAlert('Notifications Enabled', 'You will now receive alerts for overdue invoices, invoice views, and payments.');
    } else {
      showAlert('Permission Required', 'Please enable notification permissions in your device settings to receive alerts.');
    }
  };

  const handleSendTestNotification = async () => {
    setIsTestingNotif(true);
    try {
      // 1. Immediately trigger native local notification banner
      await triggerLocalNotification({
        title: 'Follope Alert',
        body: 'Mobile notifications are active! You will be notified when clients view invoices or make payments.',
        data: { screen: 'notifications' },
        channelId: 'reminders',
      });

      // 2. Also trigger backend push service test
      await sendTestNotification.mutateAsync().catch(() => null);

      showAlert('Test Notification Sent', 'A notification banner has been dispatched to your device.');
    } catch (err) {
      showAlert('Notice', 'Could not dispatch test notification. Please ensure permissions are granted.');
    } finally {
      setIsTestingNotif(false);
    }
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      const refreshToken = await getStoredRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => null);
      }
    } finally {
      await clearSession();
      setIsLoggingOut(false);
      router.replace('/(auth)/welcome');
    }
  };

  const onLogout = () => {
    confirmAction('Log out', 'Are you sure you want to log out?', performLogout, 'Log out');
  };


  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Settings</Text>

        <SettingsSection title="Profile">
          <SettingsRow label="Name" value={user?.name} />
          <SettingsRow label="Email" value={user?.email} />
        </SettingsSection>

        <SettingsSection title="Business">
          <SettingsRow label="Business details" onPress={() => router.push('/(main)/settings/business')} />
          <SettingsRow label="Branding & logo" onPress={() => router.push('/(main)/settings/branding')} />
        </SettingsSection>

        <SettingsSection title="Payments">
          <SettingsRow label="UPI payment details" onPress={() => router.push('/(main)/settings/payments')} />
        </SettingsSection>

        <SettingsSection title="Invoice">
          <SettingsRow label="Invoice template & defaults" onPress={() => router.push('/(main)/settings/invoice-template')} />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            label="Device notifications"
            value={notifPermission}
            onPress={notifPermission !== 'Enabled' ? handleRequestPermission : undefined}
          />
          <SettingsRow
            label="Send test notification"
            value={isTestingNotif ? 'Sending…' : undefined}
            onPress={handleSendTestNotification}
          />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsRow
            label="Theme"
            value={themePreference === 'system' ? 'System' : themePreference[0].toUpperCase() + themePreference.slice(1)}
            onPress={() => router.push('/(main)/settings/appearance')}
          />
        </SettingsSection>

        <SettingsSection title="Security">
          <SettingsRow label="Change password" onPress={() => router.push('/(main)/settings/change-password')} />
          <SettingsRow label="Active sessions" onPress={() => router.push('/(main)/settings/sessions')} />
        </SettingsSection>

        <Pressable
          onPress={onLogout}
          disabled={isLoggingOut}
          className="flex-row items-center justify-center h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border mt-2"
        >
          <LogOut color="#EF4444" size={18} />
          <Text className="text-red-500 font-semibold ml-2">{isLoggingOut ? 'Logging out…' : 'Log Out'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
