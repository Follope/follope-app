import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const THEME_KEY = 'follope_theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark';

async function readTheme(): Promise<ThemePreference> {
  try {
    const value = Platform.OS === 'web'
      ? (typeof window === 'undefined' ? null : localStorage.getItem(THEME_KEY))
      : await SecureStore.getItemAsync(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

async function writeTheme(theme: ThemePreference) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') localStorage.setItem(THEME_KEY, theme);
    return;
  }
  await SecureStore.setItemAsync(THEME_KEY, theme);
}

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<ThemePreference>;
  setPreference: (theme: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  hydrated: false,
  hydrate: async () => {
    const preference = await readTheme();
    set({ preference, hydrated: true });
    return preference;
  },
  setPreference: async (preference) => {
    set({ preference });
    await writeTheme(preference);
  },
}));
