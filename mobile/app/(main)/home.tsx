import { useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowUpRight, FilePlus2, Plus, WalletCards, Bell, Crown } from 'lucide-react-native';
import { useCashFlowAnalytics, useDashboard, useNotifications, useCheckReminders, useSubscription } from '../../lib/queries';
import { useAuthStore } from '../../lib/authStore';
import { formatRupees } from '../../lib/schemas';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { useReadableContentWidth } from '../../lib/layout';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isRefetching, refetch } = useDashboard();
  const { data: analytics } = useCashFlowAnalytics();
  const { data: notifData } = useNotifications();
  const { data: subDetails } = useSubscription();
  const checkReminders = useCheckReminders();
  const contentStyle = useReadableContentWidth();
  const invoiceCount = data?.invoiceCount ?? 0;
  const unreadCount = notifData?.unreadCount ?? 0;

  useEffect(() => {
    checkReminders.mutate();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView
        contentContainerClassName="px-6 pt-4 pb-8"
        contentContainerStyle={contentStyle}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF7A00" />}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm font-medium">Your finance workspace</Text>
            <Text className="text-neutral-900 dark:text-white text-2xl font-bold tracking-tight mt-1" numberOfLines={1}>
              {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">Here’s your cash-flow snapshot.</Text>
          </View>

          <View className="flex-row items-center">
            {subDetails && (
              <Pressable
                onPress={() => router.push('/(main)/settings/subscription')}
                className={`px-3 py-1.5 rounded-xl flex-row items-center mr-2.5 ${
                  subDetails.isPro
                    ? 'bg-orange-500/15 border border-orange-500/30'
                    : 'bg-orange-500 active:bg-orange-600 shadow-sm'
                }`}
              >
                <Crown color={subDetails.isPro ? '#FF7A00' : '#FFFFFF'} size={13} />
                <Text
                  className={`text-xs font-bold ml-1 ${
                    subDetails.isPro ? 'text-orange-500' : 'text-white'
                  }`}
                >
                  {subDetails.isPro ? 'PRO' : 'Get Pro'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/(main)/notifications')}
              className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-card border border-neutral-200 dark:border-border items-center justify-center relative"
              accessibilityLabel="Notifications"
            >
              <Bell size={20} color="#737373" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center border-2 border-white dark:border-background">
                  <Text className="text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <View className="bg-primary rounded-3xl p-5 mt-6 overflow-hidden">
          <View className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15" />
          <View className="absolute right-12 bottom-[-62px] h-32 w-32 rounded-full border border-white/20" />
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <Text className="text-white/80 text-sm font-medium">Outstanding balance</Text>
              <Text className="text-white text-3xl font-bold mt-2" numberOfLines={1} adjustsFontSizeToFit>
                {isLoading ? '—' : formatRupees(data?.outstandingPaise ?? 0)}
              </Text>
            </View>
            <View className="h-11 w-11 rounded-2xl bg-white/20 items-center justify-center">
              <WalletCards color="white" size={21} />
            </View>
          </View>
          <View className="flex-row items-center mt-5">
            <View className="h-6 w-6 rounded-full bg-white/20 items-center justify-center mr-2">
              <ArrowUpRight color="white" size={14} />
            </View>
            <Text className="text-white/90 text-sm">Awaiting payment across {isLoading ? '—' : invoiceCount} invoices</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-3 mb-6">
          <View className="flex-1 bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs">Collected this month</Text>
            <Text className="text-neutral-900 dark:text-white text-lg font-bold mt-2" numberOfLines={1} adjustsFontSizeToFit>
              {isLoading ? '—' : formatRupees(data?.thisMonthPaise ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4">
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs">Invoices tracked</Text>
            <Text className="text-neutral-900 dark:text-white text-lg font-bold mt-2">{isLoading ? '—' : invoiceCount}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(main)/invoices/create')}
          className="bg-primary rounded-2xl h-14 flex-row items-center justify-center mb-4 active:bg-primary-dark"
          accessibilityRole="button"
          accessibilityLabel="Create a new invoice"
        >
          <Plus color="white" size={20} />
          <Text className="text-white font-semibold text-base ml-2">Create Invoice</Text>
        </Pressable>

        {subDetails && !subDetails.isPro && (
          <Pressable
            onPress={() => router.push('/(main)/settings/subscription')}
            className="mb-8 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center mr-3">
                <Crown color="#FF7A00" size={20} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs font-bold text-neutral-900 dark:text-white">Follope Free Plan</Text>
                  <Text className="text-[10px] font-bold text-orange-500 ml-2">
                    {subDetails.lifetimeInvoiceCount}/{subDetails.freeInvoiceLimit} Invoices Used
                  </Text>
                </View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
                  Upgrade to Pro for unlimited invoices & zero watermark
                </Text>
              </View>
            </View>
            <View className="px-3 py-1.5 rounded-xl bg-orange-500 flex-row items-center shadow-sm">
              <Text className="text-xs font-bold text-white">Upgrade</Text>
            </View>
          </Pressable>
        )}

        {analytics ? (
          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-7">
            <View className="flex-row justify-between items-start mb-4">
              <View>
                <Text className="text-neutral-900 dark:text-white font-semibold">Cash flow</Text>
                <Text className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">Payments received in the last 6 months</Text>
              </View>
              {analytics.overdue.count > 0 ? <View className="bg-red-500/10 rounded-full px-2.5 py-1"><Text className="text-red-500 text-xs font-semibold">{analytics.overdue.count} overdue</Text></View> : null}
            </View>
            <View className="flex-row items-end justify-between h-24">
              {analytics.months.map((month) => {
                const ceiling = Math.max(...analytics.months.map((entry) => entry.receivedPaise), 1);
                const height = Math.max(8, Math.round((month.receivedPaise / ceiling) * 72));
                return (
                  <View key={month.label} className="items-center flex-1">
                    <Text className="text-neutral-500 text-[10px] mb-1">{month.receivedPaise > 0 ? `${Math.round(month.receivedPaise / 1000) / 100}k` : ''}</Text>
                    <View className="w-5 rounded-t-md bg-primary" style={{ height }} />
                    <Text className="text-neutral-500 text-[10px] mt-1">{month.label}</Text>
                  </View>
                );
              })}
            </View>
            {analytics.overdue.count > 0 ? <Text className="text-red-500 text-xs mt-3">{formatRupees(analytics.overdue.amountPaise)} needs follow-up.</Text> : <Text className="text-green-600 dark:text-green-400 text-xs mt-3">No overdue payments right now.</Text>}
          </View>
        ) : null}

        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-neutral-900 dark:text-white font-semibold text-lg">Recent invoices</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">Stay on top of your latest work</Text>
          </View>
          {(data?.recentInvoices?.length ?? 0) > 0 ? (
            <Pressable onPress={() => router.push('/(main)/invoices')} accessibilityRole="button" accessibilityLabel="View all invoices">
              <Text className="text-primary text-sm font-semibold">View all</Text>
            </Pressable>
          ) : null}
        </View>

        {!isLoading && (data?.recentInvoices?.length ?? 0) === 0 ? (
          <EmptyState
            title="Your first invoice is one tap away"
            description="Create a polished invoice, share a UPI payment link, and track it from here."
            icon={<FilePlus2 color="#FF7A00" size={22} />}
            action={{ label: 'Create Invoice', onPress: () => router.push('/(main)/invoices/create') }}
          />
        ) : null}

        {data?.recentInvoices?.map((invoice) => (
          <Pressable
            key={invoice.id}
            onPress={() => router.push(`/(main)/invoices/${invoice.id}`)}
            className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3 active:bg-neutral-100 dark:active:bg-border"
            accessibilityRole="button"
            accessibilityLabel={`Open invoice ${invoice.invoiceNumber}`}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 pr-3">
                <Text className="text-neutral-900 dark:text-white font-semibold" numberOfLines={1}>{invoice.client.name}</Text>
                <Text className="text-neutral-600 dark:text-neutral-400 text-xs mt-1">{invoice.invoiceNumber}</Text>
              </View>
              <StatusBadge status={invoice.status} />
            </View>
            <View className="flex-row justify-end items-end">
              <Text className="text-neutral-900 dark:text-white font-bold">{formatRupees(invoice.totalPaise)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
