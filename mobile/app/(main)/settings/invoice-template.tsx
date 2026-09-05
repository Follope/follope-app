import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { businessSchema, type BusinessInput } from '../../../lib/schemas';
import { useBusiness, useUpdateBusiness } from '../../../lib/queries';

export default function InvoiceTemplateScreen() {
  const { data: business } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { control, handleSubmit, reset } = useForm<BusinessInput>({ resolver: zodResolver(businessSchema) });

  useEffect(() => {
    if (business) {
      reset({
        invoicePrefix: business.invoicePrefix ?? 'FOL',
        defaultDuePeriodDays: business.defaultDuePeriodDays ?? 7,
        defaultTaxRateBps: business.defaultTaxRateBps ? business.defaultTaxRateBps / 100 : 0,
        defaultInvoiceNotes: business.defaultInvoiceNotes ?? '',
      });
    }
  }, [business, reset]);

  const submit = (values: BusinessInput) => {
    const taxPercent = Number(values.defaultTaxRateBps ?? 0);
    updateBusiness.mutate({ ...values, defaultTaxRateBps: Math.round(taxPercent * 100) });
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-2xl p-4 mb-5">
          <Text className="text-primary font-semibold">Your reusable invoice template</Text>
          <Text className="text-neutral-700 dark:text-orange-100 text-sm leading-5 mt-1">
            These details prefill every new invoice. You can still edit them before sending.
          </Text>
        </View>
        <FormInput control={control} name="invoicePrefix" label="Invoice number prefix" placeholder="FOL" autoCapitalize="characters" />
        <FormInput control={control} name="defaultDuePeriodDays" label="Default payment due in (days)" keyboardType="number-pad" />
        <FormInput control={control} name="defaultTaxRateBps" label="Default tax rate (%)" keyboardType="decimal-pad" />
        <FormInput control={control} name="defaultInvoiceNotes" label="Default note to client" placeholder="Thank you for your business." multiline />
        <Button label="Save Template" onPress={handleSubmit(submit)} loading={updateBusiness.isPending} />
        {updateBusiness.isSuccess ? <Text className="text-sm text-green-600 dark:text-green-500 mt-3 text-center">Invoice template saved</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
