import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
] as const;

export default function PaymentMethodScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFinish = async () => {
    setIsSubmitting(true);
    try {
      await api.patch('/me/profile', { preferredPaymentMethod: selected });
      await api.post('/me/onboarding/complete');
    } catch {
      // Onboarding completion is a nice-to-have flag, not a blocker — if
      // this call fails (e.g. offline), still let the user into the app
      // rather than trapping them on the onboarding flow.
    } finally {
      setIsSubmitting(false);
      router.replace('/(main)/home');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background px-6">
      <View className="mt-6 mb-8">
        <Text className="text-sm text-primary mb-2">Step 3 of 3</Text>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">How do you usually get paid?</Text>
      </View>

      <View className="gap-3">
        {METHODS.map((method) => {
          const isSelected = selected === method.value;
          return (
            <Pressable
              key={method.value}
              onPress={() => setSelected(method.value)}
              className={`px-4 py-4 rounded-xl border ${
                isSelected ? 'bg-primary border-primary' : 'bg-neutral-50 dark:bg-card border-neutral-200 dark:border-border'
              }`}
            >
              <Text className={`text-base font-medium ${isSelected ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {method.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />

      <View className="mb-8">
        <Button label="Finish" disabled={!selected} loading={isSubmitting} onPress={onFinish} />
      </View>
    </SafeAreaView>
  );
}
