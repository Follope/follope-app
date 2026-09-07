import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Linking } from 'react-native';
import { Crown, Sparkles, X, Check, Zap, ShieldCheck } from 'lucide-react-native';
import { useAuthStore } from '../lib/authStore';
import type { SubscriptionDetails } from '../lib/types';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenRedeem?: () => void;
  subscription?: SubscriptionDetails;
}

export function UpgradeModal({ visible, onClose, onOpenRedeem, subscription }: UpgradeModalProps) {
  const user = useAuthStore((s) => s.user);
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL' | 'LIFETIME'>('ANNUAL');

  const monthlyPrice = Math.round((subscription?.pricing?.proMonthlyPaise ?? 29900) / 100);
  const annualPrice = Math.round((subscription?.pricing?.proAnnualPaise ?? 249900) / 100);
  const lifetimePrice = Math.round((subscription?.pricing?.lifetimePaise ?? 499900) / 100);

  const handleSubscribe = () => {
    const planLabel = selectedPlan === 'ANNUAL'
      ? `Pro Annual (₹${annualPrice}/year)`
      : selectedPlan === 'LIFETIME'
      ? `Lifetime Pass (₹${lifetimePrice})`
      : `Pro Monthly (₹${monthlyPrice}/mo)`;

    const text = `Hi Follope Team! I want to upgrade my account to *${planLabel}*.\nAccount Email: ${user?.email || 'N/A'}\nPlease share UPI / Payment details to activate immediately.`;
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/75 justify-end">
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl border-t border-neutral-200 dark:border-neutral-800 max-h-[90%] flex-col">
          {/* TOP DRAG HANDLE & CLOSE */}
          <View className="p-4 pb-2 flex-row items-center justify-between border-b border-neutral-100 dark:border-neutral-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-lg bg-orange-500/20 items-center justify-center mr-2">
                <Crown color="#FF7A00" size={18} />
              </View>
              <Text className="text-base font-bold text-neutral-900 dark:text-white">Upgrade to Follope Pro</Text>
            </View>
            <Pressable onPress={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X color="#6B6B6B" size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5 pb-8">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-5 leading-relaxed">
              Remove all limitations, unlock unlimited invoicing, and give your clients a 100% white-label experience.
            </Text>

            {/* FEATURE CHECKLIST */}
            <View className="bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 mb-6 space-y-3">
              <View className="flex-row items-center space-x-2.5">
                <Check color="#10B981" size={16} />
                <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2">
                  <Text className="font-bold text-orange-500">Unlimited Invoices</Text> — no 3-invoice lifetime limit
                </Text>
              </View>
              <View className="flex-row items-center space-x-2.5 mt-2">
                <Check color="#10B981" size={16} />
                <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2">
                  <Text className="font-bold text-orange-500">Unlimited Edits</Text> — edit & revise invoices without locking
                </Text>
              </View>
              <View className="flex-row items-center space-x-2.5 mt-2">
                <Check color="#10B981" size={16} />
                <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2">
                  <Text className="font-bold text-orange-500">Remove Watermark</Text> — no "Created with Follope" on PDFs & links
                </Text>
              </View>
              <View className="flex-row items-center space-x-2.5 mt-2">
                <Check color="#10B981" size={16} />
                <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2">
                  <Text className="font-bold text-orange-500">Automated WhatsApp Reminders</Text> & view tracking
                </Text>
              </View>
              <View className="flex-row items-center space-x-2.5 mt-2">
                <Check color="#10B981" size={16} />
                <Text className="text-xs text-neutral-800 dark:text-neutral-200 font-medium ml-2">
                  <Text className="font-bold text-orange-500">Priority Support</Text> & custom invoicing branding
                </Text>
              </View>
            </View>

            {/* PLAN CARDS */}
            <Text className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Choose Your Plan</Text>
            
            {/* PLAN 1: ANNUAL (MOST POPULAR) */}
            <Pressable
              onPress={() => setSelectedPlan('ANNUAL')}
              className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${
                selectedPlan === 'ANNUAL'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <View className="flex-1 pr-2">
                <View className="flex-row items-center space-x-2 mb-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Pro Annual</Text>
                  <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 ml-2">
                    <Text className="text-[10px] font-bold text-emerald-400">Save 30%</Text>
                  </View>
                </View>
                <Text className="text-xs text-neutral-500">Billed yearly (~₹{Math.round(annualPrice / 12)}/month)</Text>
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
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-1">Pro Monthly</Text>
                <Text className="text-xs text-neutral-500">Flexible month-to-month billing</Text>
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
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <View className="flex-1 pr-2">
                <View className="flex-row items-center space-x-2 mb-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Lifetime Pass</Text>
                  <View className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 ml-2">
                    <Text className="text-[10px] font-bold text-purple-400">One-Time</Text>
                  </View>
                </View>
                <Text className="text-xs text-neutral-500">Pay once, enjoy Follope Pro forever</Text>
              </View>
              <View className="items-end">
                <Text className="text-lg font-extrabold text-neutral-900 dark:text-white font-mono">₹{lifetimePrice}</Text>
                <Text className="text-[10px] text-neutral-400">forever</Text>
              </View>
            </Pressable>

            {/* CTA BUTTON */}
            <Pressable
              onPress={handleSubscribe}
              className="w-full py-3.5 rounded-2xl bg-orange-500 active:bg-orange-600 flex-row items-center justify-center space-x-2 shadow-lg shadow-orange-500/25"
            >
              <Zap color="#FFFFFF" size={18} />
              <Text className="text-white text-sm font-bold ml-2">
                Upgrade to {selectedPlan === 'LIFETIME' ? 'Lifetime' : selectedPlan === 'ANNUAL' ? 'Annual Pro' : 'Monthly Pro'}
              </Text>
            </Pressable>

            {/* REDEEM / REFER ALTERNATIVES */}
            <View className="flex-row items-center justify-center space-x-4 mt-4">
              {onOpenRedeem && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenRedeem();
                  }}
                  className="py-1"
                >
                  <Text className="text-xs font-semibold text-orange-400 underline">
                    Have a promo code? Redeem here
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
