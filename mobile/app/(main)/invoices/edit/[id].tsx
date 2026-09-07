import { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react-native';
import { Button } from '../../../../components/Button';
import { FormInput } from '../../../../components/FormInput';
import { createInvoiceSchema, type CreateInvoiceInput, formatRupees, rupeesToPaise } from '../../../../lib/schemas';
import { useInvoice, useUpdateInvoice } from '../../../../lib/queries';
import { ApiError } from '../../../../lib/api';
import { showAlert } from '../../../../lib/alert';

type EditInput = CreateInvoiceInput & { reason?: string };

function total(items: CreateInvoiceInput['items']) {
  return (items || []).reduce((sum, item) => {
    const gross = Math.round((Number(item?.quantity) || 0) * (Number(item?.unitPricePaise) || 0));
    const taxable = Math.max(gross - (Number(item?.discountPaise) || 0), 0);
    return sum + taxable + Math.round((taxable * (Number(item?.taxRateBps) || 0)) / 10_000);
  }, 0);
}

export default function EditInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, isLoading } = useInvoice(id);
  const updateInvoice = useUpdateInvoice(id ?? '');
  const { control, reset, handleSubmit } = useForm<EditInput>({
    resolver: zodResolver(createInvoiceSchema) as never,
    defaultValues: { clientId: '', dueDate: '', items: [{ description: '', quantity: 1, unitPricePaise: 0 }], notes: '', reason: '' },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const previewTotal = useMemo(() => total(items), [items]);

  useEffect(() => {
    if (!invoice) return;
    reset({
      clientId: invoice.client.id,
      dueDate: invoice.dueDate.slice(0, 10),
      notes: invoice.notes ?? '',
      reason: '',
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPricePaise: item.unitPricePaise,
        discountPaise: item.discountPaise,
        taxRateBps: item.taxRateBps,
      })),
    });
  }, [invoice, reset]);

  if (isLoading || !invoice) {
    return <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center"><ActivityIndicator color="#FF7A00" /></SafeAreaView>;
  }

  if (invoice.paidPaise > 0 || invoice.status === 'CANCELLED') {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background px-6 items-center justify-center">
        <Text className="text-neutral-900 dark:text-white font-semibold text-lg">This invoice can no longer be edited.</Text>
        <Text className="text-neutral-600 dark:text-neutral-400 text-center mt-2">Financial records remain unchanged once a payment is recorded or an invoice is cancelled.</Text>
      </SafeAreaView>
    );
  }

  const submit = async (values: EditInput) => {
    try {
      await updateInvoice.mutateAsync(values);
      router.back();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'REVISION_LIMIT_REACHED') {
        showAlert('Revision Limit Reached', 'Free tier allows 1 edit per invoice. Upgrade to Pro or redeem a promo code in Settings for unlimited edits.');
        return;
      }
      // The button below exposes the precise backend state error on a retry.
      throw err instanceof ApiError ? err : new Error('Could not save this revision.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-6 pt-4 pb-8" keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Edit invoice</Text>
          <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1 mb-5">Saving creates revision #{(invoice.revisions?.[0]?.version ?? 0) + 1}. Client: {invoice.client.name}</Text>

          <FormInput control={control} name="dueDate" label="Due date (YYYY-MM-DD)" />
          <Text className="text-neutral-900 dark:text-white font-semibold mb-3">Items</Text>
          {fields.map((field, index) => (
            <View key={field.id} className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3">
              <Controller
                control={control}
                name={`items.${index}.description`}
                render={({ field: input }) => (
                  <TextInput
                    value={input.value}
                    onChangeText={input.onChange}
                    placeholder="Item description"
                    placeholderTextColor="#6B6B6B"
                    cursorColor="#FF7A00"
                    selectionColor="#FF7A00"
                    className="text-neutral-900 dark:text-white text-base mb-3"
                  />
                )}
              />
              <View className="flex-row gap-3 mb-2">
                <View className="flex-1">
                  <Text className="text-xs text-neutral-500 mb-1">Qty</Text>
                  <Controller
                    control={control}
                    name={`items.${index}.quantity`}
                    render={({ field: input }) => (
                      <TextInput
                        value={String(input.value ?? '')}
                        onChangeText={(text) => input.onChange(Number(text) || 0)}
                        keyboardType="decimal-pad"
                        placeholderTextColor="#6B6B6B"
                        cursorColor="#FF7A00"
                        selectionColor="#FF7A00"
                        style={{ textAlignVertical: 'center', includeFontPadding: false }}
                        className="h-11 rounded-lg bg-white dark:bg-background border border-neutral-200 dark:border-border px-3 py-1 text-neutral-900 dark:text-white"
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-neutral-500 mb-1">Unit price (₹)</Text>
                  <Controller
                    control={control}
                    name={`items.${index}.unitPricePaise`}
                    render={({ field: input }) => (
                      <TextInput
                        value={input.value ? String(input.value / 100) : ''}
                        onChangeText={(text) => input.onChange(rupeesToPaise(Number(text) || 0))}
                        keyboardType="decimal-pad"
                        placeholderTextColor="#6B6B6B"
                        cursorColor="#FF7A00"
                        selectionColor="#FF7A00"
                        style={{ textAlignVertical: 'center', includeFontPadding: false }}
                        className="h-11 rounded-lg bg-white dark:bg-background border border-neutral-200 dark:border-border px-3 py-1 text-neutral-900 dark:text-white"
                      />
                    )}
                  />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs text-neutral-500 mb-1">Discount (₹)</Text>
                  <Controller
                    control={control}
                    name={`items.${index}.discountPaise`}
                    render={({ field: input }) => (
                      <TextInput
                        value={input.value ? String(input.value / 100) : ''}
                        onChangeText={(text) => input.onChange(rupeesToPaise(Number(text) || 0))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#6B6B6B"
                        cursorColor="#FF7A00"
                        selectionColor="#FF7A00"
                        style={{ textAlignVertical: 'center', includeFontPadding: false }}
                        className="h-11 rounded-lg bg-white dark:bg-background border border-neutral-200 dark:border-border px-3 py-1 text-neutral-900 dark:text-white"
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-neutral-500 mb-1">Tax %</Text>
                  <Controller
                    control={control}
                    name={`items.${index}.taxRateBps`}
                    render={({ field: input }) => (
                      <TextInput
                        value={input.value ? String(input.value / 100) : ''}
                        onChangeText={(text) => input.onChange(Math.round((Number(text) || 0) * 100))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#6B6B6B"
                        cursorColor="#FF7A00"
                        selectionColor="#FF7A00"
                        style={{ textAlignVertical: 'center', includeFontPadding: false }}
                        className="h-11 rounded-lg bg-white dark:bg-background border border-neutral-200 dark:border-border px-3 py-1 text-neutral-900 dark:text-white"
                      />
                    )}
                  />
                </View>
              </View>
              {fields.length > 1 ? (
                <Pressable onPress={() => remove(index)} className="flex-row self-start items-center mt-3">
                  <Trash2 color="#EF4444" size={16} />
                  <Text className="text-red-500 text-sm ml-1.5">Remove item</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={() => append({ description: '', quantity: 1, unitPricePaise: 0, discountPaise: 0, taxRateBps: 0 })}
            className="flex-row justify-center items-center border border-dashed border-neutral-200 dark:border-border rounded-xl py-3 mb-5"
          >
            <Plus color="#FF7A00" size={18} />
            <Text className="text-primary font-medium ml-2">Add item</Text>
          </Pressable>
          <FormInput control={control} name="notes" label="Notes (visible to your client)" multiline />
          <FormInput control={control} name="reason" label="Revision note (optional)" placeholder="e.g. Added design review" multiline />
          <View className="bg-orange-50 dark:bg-orange-950/30 rounded-2xl p-4 mb-5 flex-row justify-between">
            <Text className="text-primary font-medium">New total</Text>
            <Text className="text-primary font-bold text-lg">{formatRupees(previewTotal)}</Text>
          </View>
          <Button label="Save revision" onPress={handleSubmit(submit)} loading={updateInvoice.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
