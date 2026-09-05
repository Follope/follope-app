import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { FormInput } from '../../../components/FormInput';
import { Button } from '../../../components/Button';
import { api, ApiError } from '../../../lib/api';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post('/me/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      router.back();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <FormInput control={control} name="currentPassword" label="Current password" secureTextEntry />
        <FormInput control={control} name="newPassword" label="New password" secureTextEntry />
        <FormInput control={control} name="confirmPassword" label="Confirm new password" secureTextEntry />

        {formError && <Text className="text-sm text-red-500 mb-4">{formError}</Text>}

        <Button label="Update Password" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </ScrollView>
    </SafeAreaView>
  );
}
