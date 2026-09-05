import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FormInput } from '../../components/FormInput';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../lib/api';

const businessInfoSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  upiId: z
    .string()
    .trim()
    .regex(/^[\w.\-]+@[\w.\-]+$/, 'Enter a valid UPI ID, e.g. name@bank')
    .optional()
    .or(z.literal('')),
});
type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

export default function BusinessInfoScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { businessName: '', phone: '', upiId: '' },
  });

  const onSubmit = async (values: BusinessInfoInput) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await Promise.all([
        api.patch('/me/profile', { role }),
        api.patch('/me/business', {
          businessName: values.businessName || undefined,
          phone: values.phone || undefined,
          upiId: values.upiId || undefined,
        }),
      ]);
      router.push('/(onboarding)/payment-method');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="flex-1 px-6" keyboardShouldPersistTaps="handled">
        <View className="mt-6 mb-8">
          <Text className="text-sm text-primary mb-2">Step 2 of 3</Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Tell us about your work</Text>
          <Text className="text-neutral-600 dark:text-neutral-400 mt-2">All optional — you can fill these in later too.</Text>
        </View>

        <FormInput control={control} name="businessName" label="Business name (optional)" />
        <FormInput control={control} name="phone" label="Phone (optional)" keyboardType="phone-pad" />
        <FormInput
          control={control}
          name="upiId"
          label="UPI ID (optional)"
          placeholder="yourname@bank"
          autoCapitalize="none"
        />

        {formError && <Text className="text-sm text-red-500 mb-4">{formError}</Text>}

        <View className="flex-1" />

        <View className="mb-8">
          <Button label="Continue" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
