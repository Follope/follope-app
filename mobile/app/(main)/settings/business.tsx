import { useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInput } from '../../../components/FormInput';
import { Button } from '../../../components/Button';
import { businessSchema, type BusinessInput } from '../../../lib/schemas';
import { useBusiness, useUpdateBusiness } from '../../../lib/queries';

export default function BusinessSettingsScreen() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();

  const { control, handleSubmit, reset } = useForm<BusinessInput>({
    resolver: zodResolver(businessSchema),
    defaultValues: {},
  });

  // Populate the form once the existing business record loads — can't set
  // defaultValues at mount time since the query hasn't resolved yet.
  useEffect(() => {
    if (business) {
      reset({
        businessName: business.businessName ?? '',
        email: business.email ?? '',
        phone: business.phone ?? '',
        address: business.address ?? '',
        gstin: business.gstin ?? '',
        pan: business.pan ?? '',
        website: business.website ?? '',
        upiId: business.upiId ?? '',
        invoicePrefix: business.invoicePrefix ?? 'FOL',
        defaultDuePeriodDays: business.defaultDuePeriodDays ?? 7,
      });
    }
  }, [business, reset]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center">
        <ActivityIndicator color="#FF7A00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <FormInput control={control} name="businessName" label="Business name" />
        <FormInput control={control} name="email" label="Business email" keyboardType="email-address" autoCapitalize="none" />
        <FormInput control={control} name="phone" label="Phone" keyboardType="phone-pad" />
        <FormInput control={control} name="address" label="Address" multiline />
        <FormInput control={control} name="gstin" label="GSTIN (optional)" autoCapitalize="characters" />
        <FormInput control={control} name="pan" label="PAN (optional)" autoCapitalize="characters" />
        <FormInput control={control} name="website" label="Website (optional)" autoCapitalize="none" />
        <Button
          label="Save Changes"
          onPress={handleSubmit((values) => updateBusiness.mutate(values))}
          loading={updateBusiness.isPending}
        />
        {updateBusiness.isSuccess && (
          <Text className="text-sm text-green-500 mt-3 text-center">Saved</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
