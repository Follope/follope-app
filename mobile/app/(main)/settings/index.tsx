import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Crown, Sparkles, Gift, Share2, Copy, Check } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { useThemeStore } from '../../../lib/themeStore';
import { useAuthStore, getStoredRefreshToken } from '../../../lib/authStore';
import { api, ApiError } from '../../../lib/api';
import { confirmAction, showAlert } from '../../../lib/alert';
import { registerForPushNotificationsAsync } from '../../../lib/notifications';
import { useSubscription, useReferral, useRedeemCoupon } from '../../../lib/queries';
import { UpgradeModal } from '../../../components/UpgradeModal';

function SettingsRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between py-4 border-b border-neutral-200 dark:border-border"
    >
      <Text className="text-neutral-900 dark:text-white text-base">{label}</Text>
      <View className="flex-row items-center">
        {value ? <Text className="text-neutral-500 mr-2">{value}</Text> : null}
        {onPress ? <ChevronRight color="#6B6B6B" size={18} /> : null}
      </View>
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-neutral-500 text-xs font-medium uppercase mb-2 px-1">{title}</Text>
      <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl px-4">{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('Checking…');
  const themePreference = useThemeStore((state) => state.preference);

  // Subscription, Referral & Coupon state
  const { data: subDetails, refetch: refetchSub } = useSubscription();
  const { data: referral } = useReferral();
  const redeemCoupon = useRedeemCoupon();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifPermission(status === 'granted' ? 'Enabled' : 'Disabled');
    }).catch(() => {
      setNotifPermission('Unavailable');
    });
  }, []);

  const handleRequestPermission = async () => {
    const res = await registerForPushNotificationsAsync();
    setNotifPermission(res.status === 'granted' ? 'Enabled' : 'Denied');
    if (res.status === 'granted') {
      showAlert('Notifications Enabled', 'You will now receive alerts for overdue invoices, invoice views, and payments.');
    } else {
      showAlert('Permission Required', 'Please enable notification permissions in your device settings to receive alerts.');
    }
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      const refreshToken = await getStoredRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => null);
      }
    } finally {
      await clearSession();
      setIsLoggingOut(false);
      router.replace('/(auth)/welcome');
    }
  };

  const onLogout = () => {
    confirmAction('Log out', 'Are you sure you want to log out?', performLogout, 'Log out');
  };

  const performDeleteAccount = async () => {
    try {
      await api.delete('/me/account');
      await clearSession();
      showAlert('Account Deleted', 'Your account and all associated data have been permanently removed.');
      router.replace('/(auth)/welcome');
    } catch (err: any) {
      showAlert('Error', err instanceof ApiError ? err.message : 'Failed to delete account. Please try again.');
    }
  };

  const onDeleteAccount = () => {
    confirmAction(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your invoices, client details, and payment histories will be permanently removed. This action cannot be undone.',
      performDeleteAccount,
      'Delete Permanently'
    );
  };

  const handleCopyReferral = async () => {
    if (!referral?.referralCode) return;
    await Clipboard.setStringAsync(referral.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!referral?.referralCode) return;
    const text = `Hey! I've been using Follope for free invoicing and automated WhatsApp payment reminders. Use my invite code *${referral.referralCode}* to get 1 Month of Free Pro:\n${referral.referralLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        }
      })
      .catch(() => {
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
      });
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setRedeemError(null);
    try {
      const res = await redeemCoupon.mutateAsync(couponInput.trim());
      setCouponInput('');
      setRedeemModalOpen(false);
      await refetchSub();
      showAlert('🎉 Promo Applied!', res.message);
    } catch (err: any) {
      setRedeemError(err instanceof ApiError ? err.message : 'Invalid or expired coupon code.');
    }
  };

  const isPro = subDetails?.isPro ?? false;
  const planName = subDetails?.tier === 'LIFETIME'
    ? 'Lifetime Pro'
    : subDetails?.tier === 'PRO_ANNUAL'
    ? 'Pro Annual'
    : subDetails?.tier === 'PRO_MONTHLY'
    ? 'Pro Monthly'
    : 'Free Plan';

  const usedInvoices = subDetails?.lifetimeInvoiceCount ?? 0;
  const maxInvoices = subDetails?.freeInvoiceLimit ?? 3;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-8">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Settings</Text>

        {/* SUBSCRIPTION & PLAN CARD */}
        <View className="mb-6 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-lg bg-orange-500/20 items-center justify-center mr-2">
                <Crown color="#FF7A00" size={18} />
              </View>
              <View>
                <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Your Subscription</Text>
                <Text className="text-lg font-bold text-white mt-0.5">{planName}</Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => setRedeemModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 flex-row items-center mr-2"
              >
                <Sparkles color="#A3A3A3" size={12} />
                <Text className="text-xs font-medium text-neutral-300 ml-1">Promo</Text>
              </Pressable>
              {!isPro && (
                <Pressable
                  onPress={() => setUpgradeModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 active:bg-orange-600 flex-row items-center shadow-md shadow-orange-500/20"
                >
                  <Crown color="#FFFFFF" size={12} />
                  <Text className="text-xs font-bold text-white ml-1">Get Pro</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* QUOTA BAR FOR FREE TIER */}
          {!isPro && (
            <View className="mt-4 pt-3 border-t border-neutral-800">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-xs text-neutral-400">Free Invoices Quota</Text>
                <Text className="text-xs font-bold text-orange-400">
                  {usedInvoices} / {maxInvoices} used
                </Text>
              </View>
              <View className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <View
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${Math.min(100, Math.max(5, (usedInvoices / maxInvoices) * 100))}%` }}
                />
              </View>
              <Text className="text-[11px] text-neutral-500 mt-2">
                • 1 edit revision allowed per invoice on Free tier
              </Text>
              <Pressable
                onPress={() => setUpgradeModalOpen(true)}
                className="mt-3 w-full py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 flex-row items-center justify-center"
              >
                <Crown color="#FF7A00" size={14} />
                <Text className="text-xs font-bold text-orange-400 ml-1.5">
                  Upgrade to Unlimited Invoices & Edits →
                </Text>
              </Pressable>
            </View>
          )}

          {isPro && subDetails?.expiresAt && (
            <Text className="text-xs text-neutral-400 mt-3 pt-3 border-t border-neutral-800">
              Active until {new Date(subDetails.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
        </View>

        {/* REFER & EARN SECTION */}
        <View className="mb-6 p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <View className="flex-row items-center space-x-2 mb-2">
            <Gift color="#FF7A00" size={18} />
            <Text className="text-base font-bold text-neutral-900 dark:text-white ml-2">Refer Friends & Earn Pro</Text>
          </View>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
            Invite fellow freelancers. When they send their first invoice, you BOTH get 1 Month of Free Pro!
          </Text>

          {referral && (
            <View className="space-y-3">
              <View className="flex-row items-center justify-between p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <View>
                  <Text className="text-[10px] uppercase font-bold text-neutral-400">Your Referral Code</Text>
                  <Text className="text-base font-mono font-bold text-orange-500 tracking-wider">
                    {referral.referralCode}
                  </Text>
                </View>
                <Pressable
                  onPress={handleCopyReferral}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex-row items-center"
                >
                  {copiedCode ? <Check color="#10B981" size={16} /> : <Copy color="#6B6B6B" size={16} />}
                  <Text className="text-xs font-semibold ml-1.5 text-neutral-700 dark:text-neutral-300">
                    {copiedCode ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleShareWhatsApp}
                className="w-full py-3 rounded-xl bg-emerald-600 active:bg-emerald-700 flex-row items-center justify-center space-x-2 mt-2"
              >
                <Share2 color="#FFFFFF" size={16} />
                <Text className="text-white text-xs font-bold ml-2">Share on WhatsApp</Text>
              </Pressable>

              {referral.totalReferred > 0 && (
                <Text className="text-[11px] text-neutral-500 text-center mt-2">
                  {referral.totalReferred} friend(s) invited · {referral.rewardMonthsEarned} month(s) earned
                </Text>
              )}
            </View>
          )}
        </View>

        <SettingsSection title="Subscription & Plans">
          <SettingsRow
            label="View Plans & Pricing"
            value={isPro ? 'Pro Active' : 'Get Pro'}
            onPress={() => router.push('/(main)/settings/subscription')}
          />
          <SettingsRow
            label="Redeem Promo Code"
            onPress={() => setRedeemModalOpen(true)}
          />
        </SettingsSection>

        <SettingsSection title="Profile">
          <SettingsRow label="Name" value={user?.name} />
          <SettingsRow label="Email" value={user?.email} />
        </SettingsSection>

        <SettingsSection title="Business">
          <SettingsRow label="Business details" onPress={() => router.push('/(main)/settings/business')} />
          <SettingsRow label="Branding & logo" onPress={() => router.push('/(main)/settings/branding')} />
        </SettingsSection>

        <SettingsSection title="Payments">
          <SettingsRow label="UPI payment details" onPress={() => router.push('/(main)/settings/payments')} />
        </SettingsSection>

        <SettingsSection title="Invoice">
          <SettingsRow label="Invoice template & defaults" onPress={() => router.push('/(main)/settings/invoice-template')} />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            label="Device notifications"
            value={notifPermission}
            onPress={notifPermission !== 'Enabled' ? handleRequestPermission : undefined}
          />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsRow
            label="Theme"
            value={themePreference === 'system' ? 'System' : themePreference[0].toUpperCase() + themePreference.slice(1)}
            onPress={() => router.push('/(main)/settings/appearance')}
          />
        </SettingsSection>

        <SettingsSection title="Security & Account">
          <SettingsRow label="Change password" onPress={() => router.push('/(main)/settings/change-password')} />
          <SettingsRow label="Active sessions" onPress={() => router.push('/(main)/settings/sessions')} />
          <SettingsRow label="Delete account" onPress={onDeleteAccount} />
        </SettingsSection>

        <Pressable
          onPress={onLogout}
          disabled={isLoggingOut}
          className="flex-row items-center justify-center h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border mt-2"
        >
          <LogOut color="#EF4444" size={18} />
          <Text className="text-red-500 font-semibold ml-2">{isLoggingOut ? 'Logging out…' : 'Log Out'}</Text>
        </Pressable>
      </ScrollView>

      {/* MODAL: REDEEM PROMO CODE */}
      <Modal visible={redeemModalOpen} transparent animationType="fade" onRequestClose={() => setRedeemModalOpen(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl">
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">Redeem Promo Code</Text>
            <Text className="text-xs text-neutral-500 mt-1 mb-4">
              Enter your coupon or partner code to unlock free Pro access and unlimited invoices.
            </Text>

            <TextInput
              value={couponInput}
              onChangeText={setCouponInput}
              placeholder="e.g. LAUNCHPRO"
              placeholderTextColor="#6B6B6B"
              autoCapitalize="characters"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white font-mono text-sm tracking-wider uppercase mb-3"
            />

            {redeemError && (
              <Text className="text-xs text-rose-500 mb-3">{redeemError}</Text>
            )}

            <View className="flex-row justify-end space-x-3 mt-2">
              <Pressable
                onPress={() => {
                  setRedeemModalOpen(false);
                  setRedeemError(null);
                }}
                className="px-4 py-2.5 rounded-xl"
              >
                <Text className="text-xs font-semibold text-neutral-500">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleApplyCoupon}
                disabled={redeemCoupon.isPending || !couponInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-orange-500 active:bg-orange-600 disabled:opacity-50 flex-row items-center"
              >
                {redeemCoupon.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-xs font-bold text-white">Apply Code</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: UPGRADE TO PRO */}
      <UpgradeModal
        visible={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onOpenRedeem={() => setRedeemModalOpen(true)}
        subscription={subDetails}
      />
    </SafeAreaView>
  );
}
