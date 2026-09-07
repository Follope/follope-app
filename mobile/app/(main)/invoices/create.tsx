import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Plus, Trash2, ChevronDown } from 'lucide-react-native';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { createInvoiceSchema, type CreateInvoiceInput, rupeesToPaise, formatRupees } from '../../../lib/schemas';
import { useBusiness, useClients, useCreateInvoice } from '../../../lib/queries';
import { ApiError } from '../../../lib/api';
import type { Client } from '../../../lib/types';
import { useReadableContentWidth } from '../../../lib/layout';

/**
 * Client-side calculation for display purposes only — this is a preview so
 * the freelancer sees the total before submitting. The backend recomputes
 * everything from raw item inputs on create (see invoiceService.ts) and is
 * the only source of truth; this preview drifting from the server's math
 * would be a UX bug, not a financial-integrity bug.
 */
function calculatePreviewTotal(items: CreateInvoiceInput['items']): number {
  return (items || []).reduce((sum, item) => {
    const gross = Math.round((Number(item?.quantity) || 0) * (Number(item?.unitPricePaise) || 0));
    const discount = Number(item?.discountPaise) || 0;
    const taxable = Math.max(gross - discount, 0);
    const tax = Math.round((taxable * (Number(item?.taxRateBps) || 0)) / 10000);
    return sum + taxable + tax;
  }, 0);
}

function defaultDueDate(days = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: clients } = useClients();
  const { data: business } = useBusiness();
  const createInvoice = useCreateInvoice();
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoiceToCreate, setInvoiceToCreate] = useState<CreateInvoiceInput | null>(null);

  const { control, handleSubmit, setValue, formState } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      clientId: '',
      dueDate: defaultDueDate(),
      items: [{ description: '', quantity: 1, unitPricePaise: 0, discountPaise: 0, taxRateBps: 0 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const previewTotal = useMemo(() => calculatePreviewTotal(items), [items]);
  const contentStyle = useReadableContentWidth();

  useEffect(() => {
    // Apply the freelancer's defaults only before they begin editing, so an
    // async profile response never overwrites an in-progress invoice.
    if (!business || formState.isDirty) return;
    setValue('dueDate', defaultDueDate(business.defaultDuePeriodDays));
    if (business.defaultTaxRateBps) {
      setValue('items', [{ description: '', quantity: 1, unitPricePaise: 0, discountPaise: 0, taxRateBps: business.defaultTaxRateBps }]);
    }
    setValue('notes', business.defaultInvoiceNotes ?? '');
  }, [business, formState.isDirty, setValue]);

  const onSelectClient = (client: Client) => {
    setSelectedClient(client);
    setValue('clientId', client.id, { shouldValidate: true });
    setClientPickerOpen(false);
  };

  const onSubmit = async (values: CreateInvoiceInput) => {
    setFormError(null);
    try {
      const invoice = await createInvoice.mutateAsync(values);
      router.replace(`/(main)/invoices/${invoice.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const onReview = (values: CreateInvoiceInput) => {
    setFormError(null);
    setInvoiceToCreate(values);
    setPreviewOpen(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-6 pt-4 pb-8" contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Create Invoice</Text>

          {/* Client picker */}
          <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Client</Text>
          <Pressable
            onPress={() => setClientPickerOpen(true)}
            className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 flex-row items-center justify-between mb-1"
          >
            <Text className={selectedClient ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}>
              {selectedClient?.name ?? 'Select a client'}
            </Text>
            <ChevronDown color="#6B6B6B" size={18} />
          </Pressable>
          <View className="mb-4" />

          <FormInput control={control} name="dueDate" label="Due date (YYYY-MM-DD)" />

          {/* Line items */}
          <Text className="text-neutral-900 dark:text-white font-semibold text-base mb-3 mt-2">Items</Text>
          {fields.map((field, index) => (
            <View key={field.id} className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3">
              <Controller
                control={control}
                name={`items.${index}.description`}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Item description"
                      placeholderTextColor="#6B6B6B"
                      cursorColor="#FF7A00"
                      selectionColor="#FF7A00"
                      className="text-neutral-900 dark:text-white text-base mb-3"
                    />
                    {error && <Text className="text-xs text-red-500 mb-2">{error.message}</Text>}
                  </>
                )}
              />

              <View className="flex-row gap-3 mb-2">
                <View className="flex-1">
                  <Text className="text-xs text-neutral-500 mb-1">Qty</Text>
                  <Controller
                    control={control}
                    name={`items.${index}.quantity`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={String(value ?? '')}
                        onChangeText={(t) => onChange(Number(t) || 0)}
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
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value ? String(value / 100) : ''}
                        onChangeText={(t) => onChange(rupeesToPaise(Number(t) || 0))}
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
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value ? String(value / 100) : ''}
                        onChangeText={(t) => onChange(rupeesToPaise(Number(t) || 0))}
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
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value ? String(value / 100) : ''}
                        onChangeText={(t) => onChange(Math.round((Number(t) || 0) * 100))}
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

              {fields.length > 1 && (
                <Pressable onPress={() => remove(index)} className="flex-row items-center mt-3 self-start">
                  <Trash2 color="#EF4444" size={16} />
                  <Text className="text-red-500 text-sm ml-1.5">Remove item</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Pressable
            onPress={() => append({ description: '', quantity: 1, unitPricePaise: 0, discountPaise: 0, taxRateBps: 0 })}
            className="flex-row items-center justify-center border border-dashed border-neutral-200 dark:border-border rounded-xl py-3 mb-6"
          >
            <Plus color="#FF7A00" size={18} />
            <Text className="text-primary font-medium ml-2">Add item</Text>
          </Pressable>

          <FormInput control={control} name="notes" label="Notes (visible to your client)" multiline />

          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-6 flex-row justify-between items-center">
            <Text className="text-neutral-600 dark:text-neutral-400">Estimated total</Text>
            <Text className="text-neutral-900 dark:text-white text-xl font-bold">{formatRupees(previewTotal)}</Text>
          </View>

          {formError && <Text className="text-sm text-red-500 mb-4">{formError}</Text>}

          <Button label="Review Invoice" onPress={handleSubmit(onReview)} />
          <Text className="text-neutral-500 text-xs text-center mt-3">
            Review the totals before creating your invoice.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={clientPickerOpen} animationType="slide" onRequestClose={() => setClientPickerOpen(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-background px-6 pt-4">
          <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Select a client</Text>
          <ScrollView>
            {(clients ?? []).length === 0 ? (
              <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-6 items-center">
                <Text className="text-neutral-900 dark:text-white font-semibold">Add a client first</Text>
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm text-center mt-2">Save their details once and reuse them on every invoice.</Text>
                <Pressable
                  onPress={() => {
                    setClientPickerOpen(false);
                    router.push('/(main)/clients/add');
                  }}
                  className="mt-5 bg-primary rounded-xl px-4 py-3"
                  accessibilityRole="button"
                >
                  <Text className="text-white font-semibold">Add Client</Text>
                </Pressable>
              </View>
            ) : (
              (clients ?? []).map((client) => (
                <Pressable
                  key={client.id}
                  onPress={() => onSelectClient(client)}
                  className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3"
                >
                  <Text className="text-neutral-900 dark:text-white font-medium">{client.name}</Text>
                  {client.company ? <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{client.company}</Text> : null}
                </Pressable>
              ))
            )}
          </ScrollView>
          <Button label="Cancel" variant="secondary" onPress={() => setClientPickerOpen(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={() => setPreviewOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-neutral-50 dark:bg-card rounded-t-3xl px-6 pt-6 max-h-[88%]"
            style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}
          >
            <View className="w-10 h-1 rounded-full bg-border self-center mb-5" />
            <Text className="text-neutral-900 dark:text-white text-xl font-bold">Review invoice</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1 mb-5">Check the details before creating it.</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="bg-white dark:bg-background border border-neutral-200 dark:border-border rounded-2xl p-4 mb-4">
                <Text className="text-neutral-500 text-xs mb-1">BILLED TO</Text>
                <Text className="text-neutral-900 dark:text-white font-semibold">{selectedClient?.name ?? 'Selected client'}</Text>
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-3">Due {invoiceToCreate?.dueDate}</Text>
              </View>

              <View className="border border-neutral-200 dark:border-border rounded-2xl p-4 mb-4">
                {(invoiceToCreate?.items ?? []).map((item, index) => {
                  const lineTotal = calculatePreviewTotal([item]);
                  return (
                    <View key={`${item.description}-${index}`} className="flex-row justify-between mb-3">
                      <View className="flex-1 pr-3">
                        <Text className="text-neutral-900 dark:text-white" numberOfLines={1}>{item.description}</Text>
                        <Text className="text-neutral-500 text-xs mt-0.5">{item.quantity} × {formatRupees(item.unitPricePaise)}</Text>
                      </View>
                      <Text className="text-neutral-700 dark:text-neutral-300">{formatRupees(lineTotal)}</Text>
                    </View>
                  );
                })}
                <View className="border-t border-neutral-200 dark:border-border pt-3 flex-row justify-between">
                  <Text className="text-neutral-900 dark:text-white font-semibold">Total</Text>
                  <Text className="text-primary text-lg font-bold">{formatRupees(calculatePreviewTotal(invoiceToCreate?.items ?? []))}</Text>
                </View>
              </View>
            </ScrollView>

            {formError ? <Text className="text-red-500 text-sm mb-3">{formError}</Text> : null}
            <Button
              label="Create Invoice"
              loading={createInvoice.isPending}
              disabled={!invoiceToCreate}
              onPress={() => invoiceToCreate && onSubmit(invoiceToCreate)}
            />
            <Pressable
              onPress={() => setPreviewOpen(false)}
              disabled={createInvoice.isPending}
              className="items-center mt-3 py-2.5 rounded-xl border border-neutral-200 dark:border-border active:bg-neutral-100"
            >
              <Text className="text-neutral-700 dark:text-neutral-300 font-medium">Edit invoice</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
