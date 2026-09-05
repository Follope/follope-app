import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { businessSchema, type BusinessInput } from '../../../lib/schemas';
import { useBusiness, useUpdateBusiness } from '../../../lib/queries';

export default function BrandingSettingsScreen() {
  const { data: business } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { control, handleSubmit, reset } = useForm<BusinessInput>({ resolver: zodResolver(businessSchema) });

  useEffect(() => {
    if (business) reset({ logoUrl: business.logoUrl ?? '', website: business.website ?? '' });
  }, [business, reset]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-neutral-600 dark:text-neutral-400 text-sm leading-5 mb-5">
          Add a public image URL to show your business logo on shared invoices. Your Follope app logo stays unchanged.
        </Text>
        <FormInput control={control} name="logoUrl" label="Business logo URL" placeholder="https://example.com/logo.png" autoCapitalize="none" />
        <FormInput control={control} name="website" label="Website (optional)" placeholder="https://yourbusiness.com" autoCapitalize="none" />
        <Button label="Save Branding" onPress={handleSubmit((values) => updateBusiness.mutate(values))} loading={updateBusiness.isPending} />
        {updateBusiness.isSuccess ? <Text className="text-sm text-green-600 dark:text-green-500 mt-3 text-center">Branding saved</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
