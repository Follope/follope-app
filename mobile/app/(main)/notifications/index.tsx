import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';
import {
  useNotifications,
  useCheckReminders,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../../lib/queries';
import { useReadableContentWidth } from '../../../lib/layout';
import type { FollopeNotification } from '../../../lib/types';
import { WhatsAppMessageModal } from '../../../components/WhatsAppMessageModal';

export default function NotificationsScreen() {
  const router = useRouter();
  const contentStyle = useReadableContentWidth(640);

  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const checkReminders = useCheckReminders();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    clientName: string;
    initialPhone?: string | null;
    publicUrl: string;
    initialMessage: string;
  }>({
    visible: false,
    title: '',
    clientName: '',
    publicUrl: '',
    initialMessage: '',
  });

  // Run a reminder check on mount
  useEffect(() => {
    checkReminders.mutate();
  }, []);

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleOpenWhatsApp = (notif: FollopeNotification) => {
    if (!notif.readAt) {
      markRead.mutate(notif.id);
    }

    const p = notif.payload;
    const msg = p?.whatsappMessage || '';
    const urlMatch = msg.match(/https?:\/\/[^\s]+/);
    const publicUrl = urlMatch ? urlMatch[0] : '';

    let phone = '';
    if (p?.whatsappUrl) {
      const phoneMatch = p.whatsappUrl.match(/wa\.me\/([0-9]+)/);
      if (phoneMatch) phone = phoneMatch[1];
    }

    setModalConfig({
      visible: true,
      title: `Follow-up: ${p?.invoiceNumber ?? 'Invoice'}`,
      clientName: p?.clientName ?? 'Client',
      initialPhone: phone,
      publicUrl,
      initialMessage: msg,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      {/* Header */}
      <View className="border-b border-neutral-200 dark:border-border px-6 py-4">
        <View style={contentStyle} className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-card items-center justify-center"
            >
              <ArrowLeft size={18} color="#737373" />
            </Pressable>
            <View>
              <Text className="text-xl font-bold text-neutral-900 dark:text-white">Follow-ups</Text>
              <Text className="text-xs text-neutral-500">
                {unreadCount > 0 ? `${unreadCount} pending action${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </Text>
            </View>
          </View>

          {unreadCount > 0 && (
            <Pressable
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-lg bg-neutral-100 dark:bg-card"
            >
              <CheckCheck size={14} color="#FF7A00" />
              <Text className="text-xs font-semibold text-primary">Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-6"
        refreshControl={<RefreshControl refreshing={isRefetching || checkReminders.isPending} onRefresh={() => refetch()} />}
      >
        <View style={contentStyle} className="w-full gap-4">
          {items.length === 0 ? (
            /* Empty State */
            <View className="items-center justify-center py-16 px-4">
              <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
                <CheckCircle2 size={32} color="#FF7A00" />
              </View>
              <Text className="text-lg font-bold text-neutral-900 dark:text-white text-center mb-2">
                All caught up!
              </Text>
              <Text className="text-sm text-neutral-500 text-center max-w-sm leading-5 mb-6">
                No overdue payments or pending follow-ups right now. We&apos;ll notify you here the moment an invoice reaches its due date.
              </Text>
              <Pressable
                onPress={() => checkReminders.mutate()}
                disabled={checkReminders.isPending}
                className="flex-row items-center gap-2 py-2 px-4 rounded-xl bg-neutral-100 dark:bg-card border border-neutral-200 dark:border-border"
              >
                <RefreshCw size={14} color="#737373" />
                <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {checkReminders.isPending ? 'Checking invoices...' : 'Check now'}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Notifications List */
            items.map((notif) => {
              const isUnread = !notif.readAt;
              const isOverdue = notif.type === 'invoice_overdue';
              const p = notif.payload;

              return (
                <View
                  key={notif.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    isUnread
                      ? 'bg-orange-50/40 dark:bg-card border-primary/30'
                      : 'bg-white dark:bg-card border-neutral-200 dark:border-border'
                  }`}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center gap-2 flex-1">
                      {isOverdue ? (
                        <View className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/50 items-center justify-center">
                          <AlertTriangle size={16} color="#DC2626" />
                        </View>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                          <Bell size={16} color="#FF7A00" />
                        </View>
                      )}

                      <View className="flex-1">
                        <Text className="text-sm font-bold text-neutral-900 dark:text-white" numberOfLines={1}>
                          {p?.title || 'Invoice Alert'}
                        </Text>
                        <Text className="text-xs text-neutral-500">
                          {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>

                    {isUnread && (
                      <View className="w-2.5 h-2.5 rounded-full bg-primary ml-2" />
                    )}
                  </View>

                  <Text className="text-sm text-neutral-700 dark:text-neutral-300 leading-5 mb-4">
                    {p?.body || 'You have an invoice update.'}
                  </Text>

                  {/* Actions for Overdue Invoices */}
                  {isOverdue && (
                    <View className="flex-row items-center gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      {p?.whatsappUrl ? (
                        <Pressable
                          onPress={() => handleOpenWhatsApp(notif)}
                          className="flex-1 flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366]"
                        >
                          <MessageCircle size={16} color="#FFFFFF" />
                          <Text className="text-xs font-bold text-white">Send WhatsApp Follow-up</Text>
                        </Pressable>
                      ) : null}

                      {p?.invoiceId ? (
                        <Pressable
                          onPress={() => {
                            if (isUnread) markRead.mutate(notif.id);
                            router.push(`/(main)/invoices/${p.invoiceId}`);
                          }}
                          className="py-2.5 px-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800"
                        >
                          <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                            View Invoice
                          </Text>
                        </Pressable>
                      ) : null}

                      {isUnread && (
                        <Pressable
                          onPress={() => markRead.mutate(notif.id)}
                          className="py-2.5 px-2.5 rounded-xl"
                        >
                          <Text className="text-xs text-neutral-400">Dismiss</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <WhatsAppMessageModal
        visible={modalConfig.visible}
        onClose={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
        title={modalConfig.title}
        clientName={modalConfig.clientName}
        initialPhone={modalConfig.initialPhone}
        publicUrl={modalConfig.publicUrl}
        initialMessage={modalConfig.initialMessage}
        mode="reminder"
      />
    </SafeAreaView>
  );
}
