import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Sparkles, Check, Gift, Copy, CreditCard, RotateCcw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../../lib/authStore';
import { useSubscription, useReferral, useRedeemCoupon, useSyncIap } from '../../../lib/queries';
import { showAlert } from '../../../lib/alert';
import { ApiError } from '../../../lib/api';
import {
  initializePurchases,
  getSubscriptionOfferings,
  purchaseSubscriptionPackage,
  restoreUserPurchases,
  hasActiveProEntitlement,
} from '../../../lib/purchases';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export default function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: subDetails, refetch: refetchSub } = useSubscription();
  const { data: referral } = useReferral();
  const redeemCoupon = useRedeemCoupon();
  const syncIap = useSyncIap();

  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL' | 'LIFETIME'>('ANNUAL');
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initializePurchases(user?.id);
        const currentOfferings = await getSubscriptionOfferings();
        if (mounted && currentOfferings) {
          setOfferings(currentOfferings);
        }
      } catch (err) {
        console.warn('Could not load Google Play offerings:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

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

  // Pricing (fallback to backend config paise or Play Store offering prices)
  const monthlyPrice = Math.round((subDetails?.pricing?.proMonthlyPaise ?? 29900) / 100);
  const annualPrice = Math.round((subDetails?.pricing?.proAnnualPaise ?? 249900) / 100);
  const lifetimePrice = Math.round((subDetails?.pricing?.lifetimePaise ?? 499900) / 100);

  const getPackageForPlan = (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME'): PurchasesPackage | null => {
    if (!offerings) return null;
    if (plan === 'ANNUAL') return offerings.annual || offerings.availablePackages.find(p => p.identifier.includes('annual')) || null;
    if (plan === 'MONTHLY') return offerings.monthly || offerings.availablePackages.find(p => p.identifier.includes('monthly')) || null;
    if (plan === 'LIFETIME') return offerings.lifetime || offerings.availablePackages.find(p => p.identifier.includes('lifetime')) || null;
    return null;
  };

  const handleSubscribe = async () => {
    const planTier = selectedPlan === 'ANNUAL' ? 'PRO_ANNUAL' : selectedPlan === 'LIFETIME' ? 'LIFETIME' : 'PRO_MONTHLY';
    setIsPurchasing(true);

    try {
      const selectedPkg = getPackageForPlan(selectedPlan);

      if (selectedPkg) {
        // Native Google Play Billing purchase via RevenueCat
        const result = await purchaseSubscriptionPackage(selectedPkg);
        if (result.userCancelled) {
          setIsPurchasing(false);
          return;
        }

        if (result.customerInfo && hasActiveProEntitlement(result.customerInfo)) {
          await syncIap.mutateAsync({
            planTier,
            productId: selectedPkg.product.identifier,
            transactionId: result.customerInfo.originalAppUserId,
          });
          await refetchSub();
          showAlert('🎉 Welcome to Pro!', 'Your Google Play subscription was successfully activated.');
        }
      } else {
        // Fallback / Sandbox mode when Play Console products are awaiting approval
        await syncIap.mutateAsync({ planTier });
        await refetchSub();
        showAlert('🎉 Plan Activated', `Activated ${planName} in development sandbox mode.`);
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      showAlert('Payment Failed', err.message || 'Could not complete Google Play purchase. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await restoreUserPurchases();
      if (hasActiveProEntitlement(customerInfo)) {
        await syncIap.mutateAsync({
          planTier: 'PRO_ANNUAL',
          transactionId: customerInfo?.originalAppUserId,
        });
        await refetchSub();
        showAlert('Purchases Restored', 'Your active Google Play subscription has been successfully restored.');
      } else {
        showAlert('No Active Subscriptions', 'No previous active subscription found for this Google Play account.');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      showAlert('Restore Failed', 'Unable to restore purchases from Google Play. Please verify network connection.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!referral?.referralCode) return;
    await Clipboard.setStringAsync(referral.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-6 pt-4 pb-12">
        {/* CURRENT STATUS CARD */}
        <View className="mb-6 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              <View className="w-9 h-9 rounded-xl bg-orange-500/20 items-center justify-center mr-2.5">
                <Crown color="#FF7A00" size={20} />
              </View>
              <View>
                <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Current Plan</Text>
                <Text className="text-xl font-bold text-white mt-0.5">{planName}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setRedeemModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 flex-row items-center"
            >
              <Sparkles color="#A3A3A3" size={13} />
              <Text className="text-xs font-medium text-neutral-300 ml-1.5">Promo Code</Text>
            </Pressable>
          </View>

          {/* QUOTA STATUS FOR FREE TIER */}
          {!isPro ? (
            <View className="mt-4 pt-4 border-t border-neutral-800">
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
            </View>
          ) : (
            <View className="mt-4 pt-3 border-t border-neutral-800">
              <Text className="text-xs text-neutral-400">
                {subDetails?.tier === 'LIFETIME'
                  ? '✨ You have Lifetime Pro Access. Enjoy all features forever!'
                  : subDetails?.expiresAt
                  ? `Active until ${new Date(subDetails.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Pro plan active'}
              </Text>
            </View>
          )}
        </View>

        {/* PRO BENEFITS */}
        <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 px-1">
          Why Go Pro?
        </Text>
        <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-6 space-y-3">
          <View className="flex-row items-center">
            <Check color="#10B981" size={16} />
            <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2.5">
              <Text className="font-bold text-orange-500">Unlimited Invoices</Text> — no 3-invoice lifetime limit
            </Text>
          </View>
          <View className="flex-row items-center mt-2.5">
            <Check color="#10B981" size={16} />
            <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2.5">
              <Text className="font-bold text-orange-500">Unlimited Edits</Text> — edit & revise invoices anytime
            </Text>
          </View>
          <View className="flex-row items-center mt-2.5">
            <Check color="#10B981" size={16} />
            <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2.5">
              <Text className="font-bold text-orange-500">No Watermarks</Text> — 100% white-label client PDFs & links
            </Text>
          </View>
          <View className="flex-row items-center mt-2.5">
            <Check color="#10B981" size={16} />
            <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2.5">
              <Text className="font-bold text-orange-500">Automated Reminders</Text> — WhatsApp & email follow-ups
            </Text>
          </View>
          <View className="flex-row items-center mt-2.5">
            <Check color="#10B981" size={16} />
            <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2.5">
              <Text className="font-bold text-orange-500">Priority Support</Text> — direct developer assistance
            </Text>
          </View>
        </View>

        {/* PRICING PLANS */}
        <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 px-1">
          Select A Plan
        </Text>

        {/* PLAN 1: ANNUAL */}
        <Pressable
          onPress={() => setSelectedPlan('ANNUAL')}
          className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${
            selectedPlan === 'ANNUAL'
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-neutral-200 dark:border-border bg-neutral-50 dark:bg-card'
          }`}
        >
          <View className="flex-1 pr-2">
            <View className="flex-row items-center space-x-2 mb-1">
              <Text className="text-sm font-bold text-neutral-900 dark:text-white">Pro Annual</Text>
              <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 ml-2">
                <Text className="text-[10px] font-bold text-emerald-400">Save 30%</Text>
              </View>
            </View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              Billed yearly (~₹{Math.round(annualPrice / 12)}/month)
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-lg font-extrabold text-neutral-900 dark:text-white font-mono">₹{annualPrice}</Text>
            <Text className="text-[10px] text-neutral-400">/year</Text>
          </View>
        </Pressable>

        {/* PLAN 2: MONTHLY */}
        <Pressable
          onPress={() => setSelectedPlan('MONTHLY')}
          className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${
            selectedPlan === 'MONTHLY'
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-neutral-200 dark:border-border bg-neutral-50 dark:bg-card'
          }`}
        >
          <View className="flex-1 pr-2">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-1">Pro Monthly</Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Flexible month-to-month billing</Text>
          </View>
          <View className="items-end">
            <Text className="text-lg font-extrabold text-neutral-900 dark:text-white font-mono">₹{monthlyPrice}</Text>
            <Text className="text-[10px] text-neutral-400">/month</Text>
          </View>
        </Pressable>

        {/* PLAN 3: LIFETIME PASS */}
        <Pressable
          onPress={() => setSelectedPlan('LIFETIME')}
          className={`p-4 rounded-2xl border mb-6 flex-row items-center justify-between ${
            selectedPlan === 'LIFETIME'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-neutral-200 dark:border-border bg-neutral-50 dark:bg-card'
          }`}
        >
          <View className="flex-1 pr-2">
            <View className="flex-row items-center space-x-2 mb-1">
              <Text className="text-sm font-bold text-neutral-900 dark:text-white">Lifetime Pass</Text>
              <View className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 ml-2">
                <Text className="text-[10px] font-bold text-purple-400">One-Time</Text>
              </View>
            </View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Pay once, enjoy Follope Pro forever</Text>
          </View>
          <View className="items-end">
            <Text className="text-lg font-extrabold text-neutral-900 dark:text-white font-mono">₹{lifetimePrice}</Text>
            <Text className="text-[10px] text-neutral-400">forever</Text>
          </View>
        </Pressable>

        {/* UPGRADE CTA BUTTON (Google Play Billing) */}
        <Pressable
          onPress={handleSubscribe}
          disabled={isPurchasing || syncIap.isPending}
          className="w-full py-4 rounded-2xl bg-orange-500 active:bg-orange-600 disabled:opacity-50 flex-row items-center justify-center space-x-2 shadow-lg shadow-orange-500/25 mb-3"
        >
          {isPurchasing || syncIap.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CreditCard color="#FFFFFF" size={18} />
              <Text className="text-white text-base font-bold ml-2">
                {isPro ? 'Manage / Renew Plan' : 'Subscribe via Google Play'} · ₹{selectedPlan === 'LIFETIME' ? lifetimePrice : selectedPlan === 'ANNUAL' ? annualPrice : monthlyPrice}
              </Text>
            </>
          )}
        </Pressable>

        {/* RESTORE PURCHASES BUTTON (Mandatory for Google Play / App Stores) */}
        <Pressable
          onPress={handleRestorePurchases}
          disabled={isRestoring}
          className="w-full py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex-row items-center justify-center mb-6"
        >
          {isRestoring ? (
            <ActivityIndicator color="#FF7A00" size="small" />
          ) : (
            <>
              <RotateCcw color="#A3A3A3" size={15} />
              <Text className="text-neutral-600 dark:text-neutral-400 text-xs font-semibold ml-2">
                Restore Google Play Purchases
              </Text>
            </>
          )}
        </Pressable>

        {/* REFER & EARN SECTION */}
        <View className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-6">
          <View className="flex-row items-center space-x-2 mb-2">
            <Gift color="#FF7A00" size={18} />
            <Text className="text-base font-bold text-neutral-900 dark:text-white ml-2">Want Free Pro? Refer Friends!</Text>
          </View>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
            Invite fellow freelancers. When they send their first invoice, you BOTH get 1 Month of Free Pro automatically!
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
            </View>
          )}
        </View>

        {/* GOOGLE PLAY MANDATORY LEGAL & SUBSCRIPTION TERMS */}
        <View className="border-t border-neutral-200 dark:border-neutral-800 pt-5 items-center">
          <Text className="text-[11px] text-neutral-400 text-center leading-relaxed mb-2 px-2">
            Payment will be charged to your Google Play account at confirmation of purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period in your Google Play Store Account Settings.
          </Text>
          <View className="flex-row items-center space-x-4 mt-1">
            <Pressable onPress={() => Linking.openURL('https://follope.com/terms')}>
              <Text className="text-xs text-orange-500 underline font-medium">Terms of Service</Text>
            </Pressable>
            <Text className="text-neutral-400 text-xs">•</Text>
            <Pressable onPress={() => Linking.openURL('https://follope.com/privacy')}>
              <Text className="text-xs text-orange-500 underline font-medium">Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* REDEEM COUPON MODAL */}
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
    </SafeAreaView>
  );
}
