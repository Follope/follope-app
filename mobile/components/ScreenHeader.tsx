import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useReadableContentWidth } from '../lib/layout';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; icon?: ReactNode; onPress: () => void; accessibilityLabel: string };
}

/** A consistent title/action treatment for primary app screens. */
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  const contentStyle = useReadableContentWidth();
  return (
    <View className="px-6">
      <View className="pt-4 pb-4 flex-row items-start justify-between" style={contentStyle}>
        <View className="flex-1 pr-4">
          <Text className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</Text>
          {subtitle ? <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{subtitle}</Text> : null}
        </View>
        {action ? (
          <Pressable
            onPress={action.onPress}
            className="min-w-11 h-11 px-3 rounded-xl bg-primary flex-row items-center justify-center active:bg-primary-dark"
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
          >
            {action.icon}
            <Text className="text-white font-semibold ml-1.5">{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
