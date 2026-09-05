import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { businessSchema, type BusinessInput } from '../../../lib/schemas';
import { useBusiness, useUpdateBusiness } from '../../../lib/queries';

export default function PaymentSettingsScreen() {
  const { data: business } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { control, handleSubmit, reset } = useForm<BusinessInput>({ resolver: zodResolver(businessSchema) });

  useEffect(() => {
    if (business) reset({ upiId: business.upiId ?? '' });
  }, [business, reset]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-neutral-600 dark:text-neutral-400 text-sm leading-5 mb-5">
          Clients will see this UPI ID on a pending invoice and can open their UPI app with the amount filled in.
        </Text>
        <FormInput control={control} name="upiId" label="UPI ID" placeholder="yourname@bank" autoCapitalize="none" />
        <Button label="Save Payment Details" onPress={handleSubmit((values) => updateBusiness.mutate(values))} loading={updateBusiness.isPending} />
        {updateBusiness.isSuccess ? <Text className="text-sm text-green-600 dark:text-green-500 mt-3 text-center">Payment details saved</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
