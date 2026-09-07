import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit2, Trash2, ArrowLeft, Plus } from 'lucide-react-native';
import { useClient, useInvoices, useUpdateClient, useDeleteClient } from '../../../lib/queries';
import { clientSchema, type ClientInput, formatRupees } from '../../../lib/schemas';
import { StatusBadge } from '../../../components/StatusBadge';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { confirmAction } from '../../../lib/alert';
import { ApiError } from '../../../lib/api';
import { useReadableContentWidth } from '../../../lib/layout';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const { data: invoices } = useInvoices({ clientId: id });
  const updateClient = useUpdateClient(id ?? '');
  const deleteClient = useDeleteClient(id ?? '');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const contentStyle = useReadableContentWidth();

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    values: client ? {
      name: client.name,
      company: client.company ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      billingAddress: client.billingAddress ?? '',
      gstin: client.gstin ?? '',
    } : undefined,
  });

  const onOpenEdit = () => {
    setActionError(null);
    if (client) {
      reset({
        name: client.name,
        company: client.company ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        billingAddress: client.billingAddress ?? '',
        gstin: client.gstin ?? '',
      });
    }
    setEditModalOpen(true);
  };

  const onUpdateSubmit = async (values: ClientInput) => {
    setActionError(null);
    try {
      await updateClient.mutateAsync(values);
      setEditModalOpen(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update client details.');
    }
  };

  const onDeleteClient = () => {
    setActionError(null);
    confirmAction(
      'Delete client?',
      `Are you sure you want to delete ${client?.name}? This action cannot be undone.`,
      async () => {
        try {
          await deleteClient.mutateAsync();
          router.replace('/(main)/clients');
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : 'Could not delete client.');
        }
      },
      'Delete'
    );
  };

  if (isLoading || !client) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center">
        <ActivityIndicator color="#FF7A00" />
      </SafeAreaView>
    );
  }

  const totalBilled = (invoices ?? []).reduce((sum, inv) => sum + inv.totalPaise, 0);
  const totalPaid = (invoices ?? []).reduce((sum, inv) => sum + inv.paidPaise, 0);
  const totalOutstanding = totalBilled - totalPaid;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" contentContainerStyle={contentStyle}>
        {/* Header with Back and Action Buttons */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border items-center justify-center active:bg-border"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#6B6B6B" size={18} />
          </Pressable>

          <View className="flex-row gap-2">
            <Pressable
              onPress={onOpenEdit}
              className="h-10 px-3.5 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border flex-row items-center active:bg-border"
              accessibilityRole="button"
              accessibilityLabel="Edit client"
            >
              <Edit2 color="#FF7A00" size={16} />
              <Text className="text-neutral-900 dark:text-white font-semibold text-sm ml-1.5">Edit</Text>
            </Pressable>

            <Pressable
              onPress={onDeleteClient}
              disabled={deleteClient.isPending}
              className="h-10 px-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex-row items-center active:bg-red-500/20"
              accessibilityRole="button"
              accessibilityLabel="Delete client"
            >
              <Trash2 color="#EF4444" size={16} />
              <Text className="text-red-500 font-semibold text-sm ml-1.5">
                {deleteClient.isPending ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">{client.name}</Text>
        {client.company ? (
          <Text className="text-neutral-600 dark:text-neutral-400 mb-6">{client.company}</Text>
        ) : (
          <View className="mb-6" />
        )}

        {actionError ? (
          <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 mb-5">
            <Text className="text-red-500 text-sm font-medium">{actionError}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs mb-1">Total billed</Text>
            <Text className="text-neutral-900 dark:text-white font-bold">{formatRupees(totalBilled)}</Text>
          </View>
          <View className="flex-1 bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs mb-1">Paid</Text>
            <Text className="text-neutral-900 dark:text-white font-bold">{formatRupees(totalPaid)}</Text>
          </View>
          <View className="flex-1 bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs mb-1">Outstanding</Text>
            <Text className="text-neutral-900 dark:text-white font-bold">{formatRupees(totalOutstanding)}</Text>
          </View>
        </View>

        {(client.email || client.phone || client.billingAddress || client.gstin) && (
          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-6">
            <Text className="text-neutral-500 text-xs uppercase font-semibold mb-3">Client Contact & Billing</Text>
            {client.phone ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-500 text-sm">Phone</Text>
                <Text className="text-neutral-900 dark:text-white font-medium">{client.phone}</Text>
              </View>
            ) : null}
            {client.email ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-500 text-sm">Email</Text>
                <Text className="text-neutral-900 dark:text-white font-medium">{client.email}</Text>
              </View>
            ) : null}
            {client.gstin ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-500 text-sm">GSTIN</Text>
                <Text className="text-neutral-900 dark:text-white font-medium">{client.gstin}</Text>
              </View>
            ) : null}
            {client.billingAddress ? (
              <View className="mt-1">
                <Text className="text-neutral-500 text-sm mb-1">Address</Text>
                <Text className="text-neutral-800 dark:text-neutral-200 text-sm">{client.billingAddress}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-neutral-900 dark:text-white font-semibold text-lg">Invoices</Text>
          <Pressable
            onPress={() => router.push('/(main)/invoices/create')}
            className="flex-row items-center"
          >
            <Plus color="#FF7A00" size={16} />
            <Text className="text-primary font-semibold text-sm ml-1">New Invoice</Text>
          </Pressable>
        </View>

        {(invoices ?? []).length === 0 && (
          <Text className="text-neutral-600 dark:text-neutral-400">No invoices for this client yet.</Text>
        )}
        {(invoices ?? []).map((invoice) => (
          <Pressable
            key={invoice.id}
            onPress={() => router.push(`/(main)/invoices/${invoice.id}`)}
            className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3 active:bg-border"
          >
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-neutral-900 dark:text-white font-medium">{invoice.invoiceNumber}</Text>
              <StatusBadge status={invoice.status} />
            </View>
            <Text className="text-neutral-900 dark:text-white font-semibold">{formatRupees(invoice.totalPaise)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Edit Client Modal */}
      <Modal visible={editModalOpen} animationType="slide" transparent onRequestClose={() => setEditModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="bg-white dark:bg-card rounded-t-3xl p-6 pb-10 max-h-[85vh]">
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Edit Client</Text>

                <FormInput control={control} name="name" label="Client or Contact Name *" placeholder="e.g. Rahul Sharma" />
                <FormInput control={control} name="company" label="Company Name (optional)" placeholder="e.g. Acme Media" />
                <FormInput control={control} name="phone" label="WhatsApp Phone Number *" placeholder="e.g. 9876543210" keyboardType="phone-pad" />
                <FormInput control={control} name="email" label="Email Address" placeholder="e.g. client@example.com" keyboardType="email-address" autoCapitalize="none" />
                <FormInput control={control} name="billingAddress" label="Billing Address" placeholder="Address, City, State, PIN" multiline numberOfLines={3} />
                <FormInput control={control} name="gstin" label="GSTIN (optional)" placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />

                {actionError ? <Text className="text-sm text-red-500 mb-4">{actionError}</Text> : null}

                <Button label="Save Changes" onPress={handleSubmit(onUpdateSubmit)} loading={isSubmitting || updateClient.isPending} />
                <Pressable onPress={() => setEditModalOpen(false)} className="mt-3 py-2 items-center">
                  <Text className="text-neutral-600 dark:text-neutral-400 font-medium">Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
