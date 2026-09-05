import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../lib/authStore';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  // Wait for session hydration from secure storage before deciding
  if (isHydrating) {
    return null;
  }

  // If already authenticated, redirect straight to main app
  if (isAuthenticated) {
    return <Redirect href="/(main)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
