import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function SettingsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme !== 'light';

  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }, headerTintColor: isDark ? '#F5F5F5' : '#171717', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="business" options={{ title: 'Business Details' }} />
      <Stack.Screen name="branding" options={{ title: 'Branding & Logo' }} />
      <Stack.Screen name="payments" options={{ title: 'Payment Details' }} />
      <Stack.Screen name="invoice-template" options={{ title: 'Invoice Template' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change Password' }} />
      <Stack.Screen name="sessions" options={{ title: 'Active Sessions' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
    </Stack>
  );
}
