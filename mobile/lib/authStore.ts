import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'follope_refresh_token';

/**
 * Cross-platform storage helper that falls back to localStorage on Web
 * and uses SecureStore (Keychain/Keystore) on iOS/Android.
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return await SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch (e) {
        console.error('Failed to set localStorage key:', e);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch (e) {
        console.error('Failed to delete localStorage key:', e);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isHydrating: boolean; // true while checking storage on app launch
  isAuthenticated: boolean;

  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  setAccessToken: (accessToken: string) => void; // used after a silent refresh
  clearSession: () => Promise<void>;
  hydrate: () => Promise<string | null>; // returns the stored refresh token, if any
}

/**
 * Access tokens live ONLY in memory (this store) — never persisted, never
 * written to AsyncStorage or SecureStore. If the app is killed, the access
 * token is gone and must be re-derived from the refresh token on next
 * launch (see hydrate() + the refresh call site in api.ts).
 *
 * Refresh tokens go to expo-secure-store (native) or localStorage (web).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrating: true,
  isAuthenticated: false,

  setSession: async (user, accessToken, refreshToken) => {
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, accessToken, isAuthenticated: true, isHydrating: false });
  },

  setAccessToken: (accessToken) => set({ accessToken }),

  clearSession: async () => {
    await storage.deleteItem(REFRESH_TOKEN_KEY);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
    set({ isHydrating: false });
    return refreshToken;
  },
}));

export function getStoredRefreshToken(): Promise<string | null> {
  return storage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): Promise<void> {
  return storage.setItem(REFRESH_TOKEN_KEY, token);
}