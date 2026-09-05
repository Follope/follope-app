import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { FormInput } from '../../../components/FormInput';
import { Button } from '../../../components/Button';
import { clientSchema, type ClientInput } from '../../../lib/schemas';
import { useCreateClient } from '../../../lib/queries';
import { ApiError } from '../../../lib/api';

export default function AddClientScreen() {
  const router = useRouter();
  const createClient = useCreateClient();
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', company: '', email: '', phone: '', billingAddress: '', gstin: '' },
  });

  const onSubmit = async (values: ClientInput) => {
    setFormError(null);
    try {
      await createClient.mutateAsync(values);
      router.back();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Add Client</Text>

        <FormInput control={control} name="name" label="Client name" />
        <FormInput control={control} name="company" label="Company (optional)" />
        <FormInput
          control={control}
          name="email"
          label="Email (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormInput control={control} name="phone" label="Phone (optional)" keyboardType="phone-pad" />
        <FormInput control={control} name="billingAddress" label="Billing address (optional)" multiline />
        <FormInput control={control} name="gstin" label="GSTIN (optional)" autoCapitalize="characters" />

        {formError && <Text className="text-sm text-red-500 mb-4">{formError}</Text>}

        <Button label="Save Client" onPress={handleSubmit(onSubmit)} loading={createClient.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
