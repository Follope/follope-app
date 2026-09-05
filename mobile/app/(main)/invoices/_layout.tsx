import { Stack } from 'expo-router';

/** Keep invoice detail flows inside the Invoices tab instead of adding each
 * nested screen to the bottom tab bar. */
export default function InvoicesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="edit/[id]" />
    </Stack>
  );
}
