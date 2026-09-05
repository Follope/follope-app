import { Stack } from 'expo-router';

/** Notifications stack layout, hidden from bottom tab bar. */
export default function NotificationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
