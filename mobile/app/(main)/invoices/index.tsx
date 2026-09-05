import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Download, FilePlus2, Plus, Search } from 'lucide-react-native';
import { useDownloadAccountingReport, useInvoices } from '../../../lib/queries';
import { formatRupees } from '../../../lib/schemas';
import { StatusBadge } from '../../../components/StatusBadge';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import type { InvoiceStatus } from '../../../lib/types';

const FILTERS: { label: string; value?: InvoiceStatus }[] = [
  { label: 'All' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Part paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function dueLabel(dueDate: string) {
  const due = new Date(dueDate);
  const today = new Date();
  const days = Math.ceil((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export default function InvoicesScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data: invoices, isLoading } = useInvoices({ status: activeFilter });
  const downloadReport = useDownloadAccountingReport();
  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices ?? [];
    return (invoices ?? []).filter((invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(term) || invoice.client.name.toLowerCase().includes(term)
    );
  }, [invoices, search]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScreenHeader
        title="Invoices"
        subtitle="Keep every payment in view"
        action={{ label: 'New', icon: <Plus color="white" size={18} />, onPress: () => router.push('/(main)/invoices/create'), accessibilityLabel: 'Create invoice' }}
      />

      <View className="px-6 mb-3">
        <View className="flex-row items-center bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-xl px-3 h-11">
          <Search color="#6B6B6B" size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice or client"
            placeholderTextColor="#6B6B6B"
            className="flex-1 ml-2 text-neutral-900 dark:text-white"
            returnKeyType="search"
            accessibilityLabel="Search invoices"
          />
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS === 'web') {
              const choice = window.prompt('Export accounting report: Type "csv" or "pdf"', 'csv');
              if (choice?.toLowerCase() === 'pdf') {
                downloadReport.mutate('pdf');
              } else if (choice?.toLowerCase() === 'csv') {
                downloadReport.mutate('csv');
              }
              return;
            }
            Alert.alert('Export current month', 'Choose a format for your accountant or GST records.', [
              { text: 'CSV', onPress: () => downloadReport.mutate('csv') },
              { text: 'PDF', onPress: () => downloadReport.mutate('pdf') },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          disabled={downloadReport.isPending}
          className="self-end flex-row items-center mt-3"
          accessibilityRole="button"
          accessibilityLabel="Export accounting report"
        >
          <Download color="#FF7A00" size={16} />
          <Text className="text-primary font-semibold text-sm ml-1.5">{downloadReport.isPending ? 'Preparing export…' : 'Export this month'}</Text>
        </Pressable>
      </View>

      <View className="shrink-0 mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-6 gap-2 items-center"
          className="flex-grow-0"
        >
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setActiveFilter(filter.value)}
                className={`h-8 px-4 rounded-full border items-center justify-center ${
                  isActive
                    ? 'bg-primary border-primary'
                    : 'bg-neutral-50 dark:bg-card border-neutral-200 dark:border-border'
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#FF7A00" /></View>
      ) : (
        <FlatList
          data={visibleInvoices}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 pb-8 flex-grow"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View className="mt-4">
              <EmptyState
                title={search ? 'No matching invoices' : 'No invoices here yet'}
                description={search ? 'Try a client name or invoice number instead.' : 'Create your first invoice and send a professional payment link.'}
                icon={<FilePlus2 color="#FF7A00" size={22} />}
                action={search ? undefined : { label: 'Create Invoice', onPress: () => router.push('/(main)/invoices/create') }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const overdue = item.status === 'OVERDUE';
            return (
              <Pressable
                onPress={() => router.push(`/(main)/invoices/${item.id}`)}
                className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3 active:bg-border"
                accessibilityRole="button"
                accessibilityLabel={`Open invoice ${item.invoiceNumber}`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-neutral-900 dark:text-white font-medium flex-1 pr-3" numberOfLines={1}>{item.client.name}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <View className="flex-row justify-between items-end">
                  <View>
                    <Text className="text-neutral-600 dark:text-neutral-400 text-xs">{item.invoiceNumber}</Text>
                    <Text className={`text-xs mt-1 ${overdue ? 'text-red-400' : 'text-neutral-500'}`}>{dueLabel(item.dueDate)}</Text>
                  </View>
                  <Text className="text-neutral-900 dark:text-white font-semibold">{formatRupees(item.balancePaise)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
