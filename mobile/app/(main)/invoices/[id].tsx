import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, ActivityIndicator, Modal, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Download, Link2Off, Share2, MessageCircle } from 'lucide-react-native';
import { useInvoice, useShareInvoice, useRecordPayment, usePayments, useDuplicateInvoice, useSendReminder, useCancelInvoice, useDownloadInvoicePdf, useRevokeInvoiceLink } from '../../../lib/queries';
import { formatRupees, recordPaymentSchema } from '../../../lib/schemas';
import { StatusBadge } from '../../../components/StatusBadge';
import { Button } from '../../../components/Button';
import { ApiError } from '../../../lib/api';
import { useReadableContentWidth } from '../../../lib/layout';
import { buildInvoiceShareMessage, buildReminderMessage, type ReminderTone } from '../../../lib/whatsapp';
import { WhatsAppMessageModal } from '../../../components/WhatsAppMessageModal';
import { confirmAction } from '../../../lib/alert';

const PAYMENT_METHODS = ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const;

function RecordPaymentModal({
  invoiceId,
  balancePaise,
  visible,
  onClose,
}: {
  invoiceId: string;
  balancePaise: number;
  visible: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(balancePaise / 100));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recordPayment = useRecordPayment(invoiceId);

  const onSubmit = async () => {
    setError(null);
    const parsed = recordPaymentSchema.safeParse({
      amountPaise: Math.round(Number(amount) * 100),
      method,
      paidAt: new Date().toISOString(),
      referenceId: referenceId.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      await recordPayment.mutateAsync(parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-neutral-50 dark:bg-card rounded-t-3xl p-6 pb-10">
          <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Record Payment</Text>

          <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            className="h-12 rounded-xl bg-white dark:bg-background border border-neutral-200 dark:border-border px-4 text-neutral-900 dark:text-white mb-4"
          />

          <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Method</Text>
          <View className="flex-row gap-2 mb-6 flex-wrap">
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                className={`px-3 py-2 rounded-lg border ${
                  method === m ? 'bg-primary border-primary' : 'bg-white dark:bg-background border-neutral-200 dark:border-border'
                }`}
              >
                <Text className={method === m ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}>{m.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>

          {method === 'UPI' ? (
            <>
              <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">UPI reference ID</Text>
              <TextInput value={referenceId} onChangeText={setReferenceId} placeholder="From your UPI app history" placeholderTextColor="#6B6B6B" autoCapitalize="characters" className="h-12 rounded-xl bg-white dark:bg-background border border-neutral-200 dark:border-border px-4 text-neutral-900 dark:text-white mb-4" />
              <Text className="text-neutral-500 text-xs -mt-2 mb-5">Required to reconcile a UPI payment and prevent duplicates.</Text>
            </>
          ) : null}

          {error && <Text className="text-sm text-red-500 mb-4">{error}</Text>}

          <Button label="Save Payment" onPress={onSubmit} loading={recordPayment.isPending} />
          <Pressable onPress={onClose} className="mt-3 items-center">
            <Text className="text-neutral-600 dark:text-neutral-400">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, isLoading } = useInvoice(id);
  const shareInvoice = useShareInvoice(id ?? '');
  const { data: payments, isLoading: isLoadingPayments } = usePayments(id);
  const duplicateInvoice = useDuplicateInvoice(id ?? '');
  const sendReminder = useSendReminder(id ?? '');
  const cancelInvoice = useCancelInvoice(id ?? '');
  const revokeInvoiceLink = useRevokeInvoiceLink(id ?? '');
  const downloadPdf = useDownloadInvoicePdf(id ?? '', invoice?.invoiceNumber ?? 'invoice');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [whatsAppModalConfig, setWhatsAppModalConfig] = useState<{
    visible: boolean;
    title: string;
    publicUrl: string;
    initialMessage: string;
    mode: 'share' | 'reminder';
  }>({
    visible: false,
    title: '',
    publicUrl: '',
    initialMessage: '',
    mode: 'share',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const contentStyle = useReadableContentWidth();

  if (isLoading || !invoice) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center">
        <ActivityIndicator color="#FF7A00" />
      </SafeAreaView>
    );
  }

  const onShareWhatsApp = async (expiresInDays = 30) => {
    setActionError(null);
    try {
      const { publicUrl } = await shareInvoice.mutateAsync(expiresInDays);
      const text = buildInvoiceShareMessage({
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        totalFormatted: formatRupees(invoice.totalPaise),
        publicUrl,
        dueDateFormatted: new Date(invoice.dueDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      });
      setWhatsAppModalConfig({
        visible: true,
        title: `Share Invoice ${invoice.invoiceNumber}`,
        publicUrl,
        initialMessage: text,
        mode: 'share',
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not prepare WhatsApp share. Please try again.');
    }
  };

  const onSendReminderWhatsApp = async () => {
    setActionError(null);
    try {
      await sendReminder.mutateAsync();
      const { publicUrl } = await shareInvoice.mutateAsync(30);
      const initialTone: ReminderTone = invoice.status === 'OVERDUE' ? 'firm' : 'friendly';
      const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const text = buildReminderMessage({
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        balanceFormatted: formatRupees(invoice.balancePaise),
        publicUrl,
        dueDateFormatted: formattedDueDate,
        tone: initialTone,
      });
      setWhatsAppModalConfig({
        visible: true,
        title: `Follow-up: ${invoice.invoiceNumber}`,
        publicUrl,
        initialMessage: text,
        mode: 'reminder',
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not prepare WhatsApp reminder. Please try again.');
    }
  };

  const handleReminderToneChange = (tone: ReminderTone) => {
    if (!invoice) return '';
    const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return buildReminderMessage({
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      balanceFormatted: formatRupees(invoice.balancePaise),
      publicUrl: whatsAppModalConfig.publicUrl,
      dueDateFormatted: formattedDueDate,
      tone,
    });
  };

  const onShare = async (expiresInDays = 30) => {
    try {
      const { publicUrl } = await shareInvoice.mutateAsync(expiresInDays);
      const shareText = `Invoice ${invoice.invoiceNumber} for ${formatRupees(invoice.totalPaise)} (valid for ${expiresInDays} days): ${publicUrl}`;

      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(shareText);
        alert('Invoice link copied to clipboard!');
      } else {
        await Share.share({
          message: shareText,
        });
      }
    } catch {
      // Share sheet cancellation
    }
  };

  const chooseShareExpiry = () => {
    if (Platform.OS === 'web') {
      void onShare(30);
      return;
    }
    Alert.alert('Share invoice', 'Choose how long this payment link should remain active.', [
      { text: '7 days', onPress: () => void onShare(7) },
      { text: '30 days', onPress: () => void onShare(30) },
      { text: '90 days', onPress: () => void onShare(90) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onDuplicate = () => {
    confirmAction(
      'Duplicate invoice?',
      'This creates a new draft with the same client and line items.',
      async () => {
        setActionError(null);
        try {
          const copy = await duplicateInvoice.mutateAsync();
          router.replace(`/(main)/invoices/${copy.id}`);
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : 'Could not duplicate this invoice. Please try again.');
        }
      },
      'Duplicate'
    );
  };

  const onSendReminder = async () => {
    setActionError(null);
    try {
      const { reminderText } = await sendReminder.mutateAsync();
      await Share.share({ message: reminderText });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not prepare the reminder. Please try again.');
    }
  };

  const onDownloadPdf = async () => {
    setActionError(null);
    try {
      await downloadPdf.mutateAsync();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not download the PDF. Please try again.');
    }
  };

  const onCancelInvoice = () => {
    confirmAction(
      'Cancel this invoice?',
      'The shared payment link will stop accepting UPI payments. This cannot be undone.',
      async () => {
        setActionError(null);
        try {
          await cancelInvoice.mutateAsync();
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : 'Could not cancel this invoice. Please try again.');
        }
      },
      'Cancel Invoice'
    );
  };

  const onRevokeLink = () => {
    confirmAction(
      'Revoke shared link?',
      'The current link will stop working. Sharing this invoice again creates a new link.',
      async () => {
        setActionError(null);
        try {
          await revokeInvoiceLink.mutateAsync();
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : 'Could not revoke this link.');
        }
      },
      'Revoke link'
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8" contentContainerStyle={contentStyle}>
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">{invoice.invoiceNumber}</Text>
          <StatusBadge status={invoice.status} />
        </View>
        <Text className="text-neutral-600 dark:text-neutral-400 mb-6">{invoice.client.name}</Text>

        <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-neutral-600 dark:text-neutral-400">Issue date</Text>
            <Text className="text-neutral-900 dark:text-white">{new Date(invoice.issueDate).toLocaleDateString('en-IN')}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-neutral-600 dark:text-neutral-400">Due date</Text>
            <Text className="text-neutral-900 dark:text-white">{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</Text>
          </View>
        </View>

        <Text className="text-neutral-900 dark:text-white font-semibold mb-3">Items</Text>
        {invoice.items.map((item) => (
          <View key={item.id} className="flex-row justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-neutral-900 dark:text-white">{item.description}</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {item.quantity} × {formatRupees(item.unitPricePaise)}
              </Text>
            </View>
            <Text className="text-neutral-900 dark:text-white">{formatRupees(item.lineTotalPaise)}</Text>
          </View>
        ))}

        <View className="border-t border-neutral-200 dark:border-border pt-3 mt-2 mb-6">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-neutral-600 dark:text-neutral-400">Subtotal</Text>
            <Text className="text-neutral-700 dark:text-neutral-300">{formatRupees(invoice.subtotalPaise)}</Text>
          </View>
          {invoice.discountPaise > 0 && (
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-neutral-600 dark:text-neutral-400">Discount</Text>
              <Text className="text-neutral-700 dark:text-neutral-300">-{formatRupees(invoice.discountPaise)}</Text>
            </View>
          )}
          {invoice.taxPaise > 0 && (
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-neutral-600 dark:text-neutral-400">Tax</Text>
              <Text className="text-neutral-700 dark:text-neutral-300">{formatRupees(invoice.taxPaise)}</Text>
            </View>
          )}
          <View className="flex-row justify-between mt-2">
            <Text className="text-neutral-900 dark:text-white font-semibold text-lg">Total</Text>
            <Text className="text-neutral-900 dark:text-white font-semibold text-lg">{formatRupees(invoice.totalPaise)}</Text>
          </View>
          {invoice.balancePaise > 0 && invoice.balancePaise !== invoice.totalPaise && (
            <View className="flex-row justify-between mt-1">
              <Text className="text-primary">Balance due</Text>
              <Text className="text-primary font-medium">{formatRupees(invoice.balancePaise)}</Text>
            </View>
          )}
        </View>

        <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-neutral-900 dark:text-white font-semibold">Payment history</Text>
            {!isLoadingPayments ? <Text className="text-neutral-500 text-xs">{payments?.length ?? 0} recorded</Text> : null}
          </View>
          {isLoadingPayments ? (
            <ActivityIndicator color="#FF7A00" />
          ) : (payments?.length ?? 0) === 0 ? (
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm">No payments recorded yet.</Text>
          ) : (
            payments?.map((payment) => (
              <View key={payment.id} className="flex-row justify-between items-center py-2 border-t border-neutral-200 dark:border-border">
                <View className="flex-1 pr-3">
                  <Text className="text-neutral-900 dark:text-white text-sm font-medium">{payment.method.replace('_', ' ')}</Text>
                  <Text className="text-neutral-500 text-xs mt-0.5">
                    {new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {payment.referenceId ? ` · ${payment.referenceId}` : ''}
                  </Text>
                </View>
                <Text className="text-green-400 font-semibold">{formatRupees(payment.amountPaise)}</Text>
              </View>
            ))
          )}
        </View>

        {(invoice.revisions?.length ?? 0) > 0 ? (
          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-6">
            <Text className="text-neutral-900 dark:text-white font-semibold mb-2">Revision history</Text>
            {invoice.revisions?.map((revision) => (
              <View key={revision.id} className="border-t border-neutral-200 dark:border-border py-2">
                <Text className="text-neutral-900 dark:text-white text-sm font-medium">Revision {revision.version}</Text>
                <Text className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">{new Date(revision.createdAt).toLocaleString('en-IN')}{revision.reason ? ` · ${revision.reason}` : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="gap-3">
          {invoice.paidPaise === 0 && invoice.status !== 'CANCELLED' ? <Button label="Edit Invoice" variant="secondary" onPress={() => router.push(`/(main)/invoices/edit/${invoice.id}`)} /> : null}
          {invoice.balancePaise > 0 && invoice.status !== 'CANCELLED' && (
            <Button label="Record Payment" onPress={() => setPaymentModalOpen(true)} />
          )}
          {invoice.status !== 'CANCELLED' ? (
            <Pressable
              onPress={() => onShareWhatsApp(30)}
              disabled={shareInvoice.isPending}
              className="h-12 rounded-xl bg-emerald-600 dark:bg-emerald-600 items-center justify-center flex-row active:bg-emerald-700"
              accessibilityRole="button"
              accessibilityLabel="Share invoice on WhatsApp"
            >
              <MessageCircle color="white" size={18} />
              <Text className="text-white font-semibold ml-2">
                {shareInvoice.isPending ? 'Preparing link…' : invoice.client.phone ? `Send to ${invoice.client.name.split(' ')[0]} on WhatsApp` : 'Share on WhatsApp'}
              </Text>
            </Pressable>
          ) : null}
          {invoice.balancePaise > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'DRAFT' ? (
            <Pressable
              onPress={onSendReminderWhatsApp}
              disabled={sendReminder.isPending}
              className="h-12 rounded-xl bg-neutral-900 dark:bg-card border border-neutral-700 dark:border-neutral-600 items-center justify-center flex-row active:bg-neutral-800"
              accessibilityRole="button"
              accessibilityLabel="Send payment reminder on WhatsApp"
            >
              <MessageCircle color="#34D399" size={18} />
              <Text className="text-white font-semibold ml-2">
                {sendReminder.isPending ? 'Preparing reminder…' : 'Follow Up on WhatsApp'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={chooseShareExpiry}
            className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border items-center justify-center flex-row active:bg-border"
          >
            <Share2 color="#6B6B6B" size={18} />
            <Text className="text-neutral-900 dark:text-white font-semibold ml-2">
              {shareInvoice.isPending ? 'Sharing…' : 'More Share Options…'}
            </Text>
          </Pressable>
          {invoice.sentAt || invoice.publicLinkExpiresAt ? (
            <Pressable onPress={onRevokeLink} disabled={revokeInvoiceLink.isPending} className="h-12 rounded-xl border border-red-300 dark:border-red-900 items-center justify-center flex-row">
              <Link2Off color="#EF4444" size={17} />
              <Text className="text-red-500 font-semibold ml-2">{revokeInvoiceLink.isPending ? 'Revoking…' : 'Revoke shared link'}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDownloadPdf}
            disabled={downloadPdf.isPending}
            className={`h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border items-center justify-center flex-row active:bg-border ${downloadPdf.isPending ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            accessibilityLabel="Download and share invoice PDF"
          >
            <Download color="#F5F5F5" size={18} />
            <Text className="text-neutral-900 dark:text-white font-semibold ml-2">{downloadPdf.isPending ? 'Preparing PDF…' : 'Download PDF'}</Text>
          </Pressable>
          <Button label="Duplicate Invoice" variant="secondary" onPress={onDuplicate} loading={duplicateInvoice.isPending} />
          {invoice.status !== 'CANCELLED' && invoice.paidPaise === 0 ? (
            <Pressable onPress={onCancelInvoice} disabled={cancelInvoice.isPending} className="h-12 items-center justify-center flex-row" accessibilityRole="button">
              <Ban color="#EF4444" size={16} />
              <Text className="text-red-500 font-semibold ml-2">{cancelInvoice.isPending ? 'Cancelling…' : 'Cancel Invoice'}</Text>
            </Pressable>
          ) : null}
          {actionError ? <Text className="text-sm text-red-500 text-center">{actionError}</Text> : null}
        </View>
      </ScrollView>

      <RecordPaymentModal
        invoiceId={invoice.id}
        balancePaise={invoice.balancePaise}
        visible={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
      />

      <WhatsAppMessageModal
        visible={whatsAppModalConfig.visible}
        onClose={() => setWhatsAppModalConfig((prev) => ({ ...prev, visible: false }))}
        title={whatsAppModalConfig.title}
        clientName={invoice.client.name}
        initialPhone={invoice.client.phone}
        publicUrl={whatsAppModalConfig.publicUrl}
        initialMessage={whatsAppModalConfig.initialMessage}
        mode={whatsAppModalConfig.mode}
        onToneChange={handleReminderToneChange}
      />
    </SafeAreaView>
  );
}
