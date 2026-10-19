import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['subscription'] }).finally(() => {
      router.replace('/(main)/settings/subscription');
    });
  }, [queryClient, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-background px-6">
      <ActivityIndicator color="#FF7A00" size="large" />
      <Text className="mt-4 text-neutral-700 dark:text-neutral-300">Confirming your subscription…</Text>
    </View>
  );
}
