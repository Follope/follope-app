import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useThemeStore, type ThemePreference } from '../../../lib/themeStore';

const options: Array<{ value: ThemePreference; title: string; description: string; icon: typeof Sun }> = [
  { value: 'system', title: 'Use device setting', description: 'Match your phone automatically.', icon: Monitor },
  { value: 'light', title: 'Light', description: 'A clean, bright workspace.', icon: Sun },
  { value: 'dark', title: 'Dark', description: 'Easy on the eyes in low light.', icon: Moon },
];

export default function AppearanceScreen() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const { setColorScheme } = useColorScheme();

  const selectTheme = async (theme: ThemePreference) => {
    setColorScheme(theme);
    await setPreference(theme);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background" edges={['bottom']}>
      <View className="px-6 pt-6">
        <Text className="text-neutral-900 dark:text-white text-2xl font-bold">Appearance</Text>
        <Text className="text-neutral-600 dark:text-neutral-400 mt-2 leading-5">
          Choose the look that feels right for your workday.
        </Text>

        <View className="mt-7 gap-3">
          {options.map(({ value, title, description, icon: Icon }) => {
            const selected = preference === value;
            return (
              <Pressable
                key={value}
                onPress={() => void selectTheme(value)}
                className={`rounded-2xl border p-4 flex-row items-center ${selected ? 'border-primary bg-orange-50 dark:bg-orange-950/30' : 'border-neutral-200 bg-neutral-50 dark:border-border dark:bg-card'}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View className={`h-11 w-11 rounded-xl items-center justify-center ${selected ? 'bg-primary' : 'bg-neutral-200 dark:bg-border'}`}>
                  <Icon color={selected ? '#FFFFFF' : '#6B6B6B'} size={20} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-neutral-900 dark:text-white font-semibold">{title}</Text>
                  <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{description}</Text>
                </View>
                {selected ? <Check color="#FF7A00" size={21} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
