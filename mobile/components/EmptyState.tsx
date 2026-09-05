import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
}

/** Calm, action-oriented empty state used across lists and dashboards. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl px-6 py-7 items-center">
      {icon ? <View className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center mb-4">{icon}</View> : null}
      <Text className="text-neutral-900 dark:text-white font-semibold text-base text-center">{title}</Text>
      <Text className="text-neutral-600 dark:text-neutral-400 text-sm text-center leading-5 mt-1.5 mb-5">{description}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} className="w-full" /> : null}
    </View>
  );
}
