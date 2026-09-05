import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/authStore';

/** The bare Expo development URL must always open the app entry point, not
 * restore the last shared-invoice deep link from Expo Go's navigation state. */
export default function AppIndex() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return null;
  }

  return <Redirect href={isAuthenticated ? '/(main)/home' : '/(auth)/welcome'} />;
}
