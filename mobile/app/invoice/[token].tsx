import { useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Image, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatRupees } from '../../lib/schemas';
import { useReadableContentWidth } from '../../lib/layout';

// Explicitly mirrors the safe allow-list returned by the public API.
interface PublicInvoice {
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: string;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  balancePaise: number;
  clientDisplayName: string;
  notes: string | null;
  business: {
    displayName: string;
    logoUrl: string | null;
    upiId: string | null;
    gstin: string | null;
  };
  upi: {
    payUri: string;
    qrCodeDataUrl: string;
  } | null;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PublicInvoiceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const publicToken = Array.isArray(token) ? token[0] : token;
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const contentStyle = useReadableContentWidth(640);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['public-invoice', publicToken],
    queryFn: () => api.get<PublicInvoice>(`/public/invoices/${encodeURIComponent(publicToken)}`),
    enabled: Boolean(publicToken),
    // A payment recorded by the sender must remove an old QR code even if a
    // recipient leaves this screen open. The server returns no UPI payload
    // once the balance reaches zero.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const openUpiApp = async () => {
    if (!invoice?.upi) return;
    setPaymentError(null);
    try {
      if (!(await Linking.canOpenURL(invoice.upi.payUri))) {
        setPaymentError('No supported UPI app was found. Please scan the QR code with your payment app.');
        return;
      }
      await Linking.openURL(invoice.upi.payUri);
    } catch {
      setPaymentError('Unable to open a UPI app. Please scan the QR code instead.');
    }
  };

  if (isLoading) {
    return <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center"><ActivityIndicator color="#FF7A00" /></SafeAreaView>;
  }

  if (error || !invoice) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center px-6">
        <Text className="text-neutral-900 dark:text-white text-lg font-semibold mb-2">Invoice unavailable</Text>
        <Text className="text-neutral-600 dark:text-neutral-400 text-center max-w-sm mb-4">
          {error instanceof Error ? error.message : 'This invoice link may be invalid or no longer available.'}
        </Text>
      </SafeAreaView>
    );
  }

  const isCancelled = invoice.status === 'CANCELLED';
  const isPaid = invoice.balancePaise <= 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-8 pb-10" contentContainerStyle={contentStyle}>
        <View className="mb-6">
          {invoice.business.logoUrl ? <Image source={{ uri: invoice.business.logoUrl }} className="w-10 h-10 rounded-lg mb-3" /> : null}
          <Text className="text-neutral-600 dark:text-neutral-400 text-sm mb-1">Invoice from</Text>
          <Text className="text-neutral-900 dark:text-white text-2xl font-bold">{invoice.business.displayName}</Text>
        </View>

        <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-5 mb-4">
          <View className="flex-row justify-between items-start mb-5">
            <View>
              <Text className="text-neutral-900 dark:text-white text-xl font-bold">{invoice.invoiceNumber}</Text>
              <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">Issued {formatDate(invoice.issueDate)}</Text>
            </View>
            <Text className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCancelled ? 'bg-red-500/15 text-red-400' : isPaid ? 'bg-green-500/15 text-green-400' : 'bg-primary/15 text-primary'}`}>
              {isCancelled ? 'Cancelled' : isPaid ? 'Paid' : 'Payment due'}
            </Text>
          </View>
          <View className="border-t border-neutral-200 dark:border-border pt-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mb-1">Billed to</Text>
            <Text className="text-neutral-900 dark:text-white font-medium">{invoice.clientDisplayName}</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-4">Due {formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-5 mb-4">
          <Text className="text-neutral-900 dark:text-white font-semibold mb-4">Items</Text>
          {invoice.items.map((item, index) => (
            <View key={`${item.description}-${index}`} className="flex-row justify-between mb-4">
              <View className="flex-1 pr-4">
                <Text className="text-neutral-900 dark:text-white">{item.description}</Text>
                <Text className="text-neutral-500 text-xs mt-1">{item.quantity} × {formatRupees(item.unitPricePaise)}</Text>
              </View>
              <Text className="text-neutral-900 dark:text-white font-medium">{formatRupees(item.lineTotalPaise)}</Text>
            </View>
          ))}
          <View className="border-t border-neutral-200 dark:border-border pt-4">
            <View className="flex-row justify-between mb-2"><Text className="text-neutral-600 dark:text-neutral-400">Subtotal</Text><Text className="text-neutral-700 dark:text-neutral-300">{formatRupees(invoice.subtotalPaise)}</Text></View>
            {invoice.discountPaise > 0 ? <View className="flex-row justify-between mb-2"><Text className="text-neutral-600 dark:text-neutral-400">Discount</Text><Text className="text-neutral-700 dark:text-neutral-300">−{formatRupees(invoice.discountPaise)}</Text></View> : null}
            {invoice.taxPaise > 0 ? <View className="flex-row justify-between mb-2"><Text className="text-neutral-600 dark:text-neutral-400">Tax</Text><Text className="text-neutral-700 dark:text-neutral-300">{formatRupees(invoice.taxPaise)}</Text></View> : null}
            <View className="flex-row justify-between mt-2"><Text className="text-neutral-900 dark:text-white text-lg font-semibold">Total</Text><Text className="text-neutral-900 dark:text-white text-lg font-semibold">{formatRupees(invoice.totalPaise)}</Text></View>
          </View>
        </View>

        {invoice.notes ? <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-5 mb-4"><Text className="text-neutral-600 dark:text-neutral-400 text-sm mb-1">Note from {invoice.business.displayName}</Text><Text className="text-neutral-900 dark:text-white">{invoice.notes}</Text></View> : null}
        {invoice.business.gstin ? <Text className="text-neutral-500 text-xs mb-4">GSTIN: {invoice.business.gstin}</Text> : null}

        {isCancelled ? (
          <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 items-center"><Text className="text-red-400 font-semibold">This invoice has been cancelled.</Text></View>
        ) : isPaid ? (
          <View className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 items-center"><Text className="text-green-400 font-semibold text-lg">Fully paid</Text></View>
        ) : (
          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-5 items-center">
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mb-1">Balance due</Text>
            <Text className="text-primary text-2xl font-bold mb-5">{formatRupees(invoice.balancePaise)}</Text>
            {invoice.upi ? <>
              <Text className="text-neutral-900 dark:text-white font-semibold mb-1">Pay via UPI</Text>
              <Text className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">{invoice.business.upiId}</Text>
              <View className="bg-white p-2 rounded-xl mb-5"><Image source={{ uri: invoice.upi.qrCodeDataUrl }} style={{ width: 200, height: 200 }} /></View>
              <Pressable onPress={openUpiApp} className="bg-primary px-6 py-3 rounded-xl w-full items-center active:bg-primary-dark" accessibilityRole="button" accessibilityLabel="Pay this invoice with UPI"><Text className="text-white font-semibold text-base">Open UPI app</Text></Pressable>
              {paymentError ? <Text className="text-amber-400 text-sm text-center mt-3">{paymentError}</Text> : null}
            </> : <Text className="text-neutral-600 dark:text-neutral-400 text-center">Contact {invoice.business.displayName} for payment details.</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
