import { useState, useEffect } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';
import { useReadableContentWidth } from '../../lib/layout';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const contentStyle = useReadableContentWidth(480);

  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Request 6-digit reset code
  const handleSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password/send-otp', { email: trimmedEmail }, { skipAuth: true });
      setStep('verify');
      setCooldown(60);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify code & set new password
  const handleResetPassword = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setFormError('Please enter the 6-digit verification code');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post(
        '/auth/forgot-password/verify-otp',
        {
          email: email.trim().toLowerCase(),
          code: trimmedCode,
          newPassword,
        },
        { skipAuth: true }
      );
      setStep('success');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Invalid code or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background">
        <View className="flex-1 px-6 justify-center items-center" style={contentStyle}>
          <View className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 items-center justify-center mb-6">
            <CheckCircle2 size={36} color="#10B981" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white text-center mb-2">
            Password Reset Successful
          </Text>
          <Text className="text-neutral-600 dark:text-neutral-400 text-center mb-8 max-w-80 leading-5">
            Your password has been updated securely. You can now sign in with your new credentials.
          </Text>
          <View className="w-full">
            <Button label="Go to Login" onPress={() => router.replace('/(auth)/login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow px-6 pt-8 pb-10" keyboardShouldPersistTaps="handled">
          <View style={contentStyle} className="w-full">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center mb-6 self-start py-1 px-2 rounded-lg bg-neutral-100 dark:bg-card"
            >
              <ArrowLeft size={16} color="#737373" />
              <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-300 ml-1">Back</Text>
            </Pressable>

            <BrandLogo width={120} height={38} />

            <Text className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mt-7">
              {step === 'request' ? 'Reset your password' : 'Enter reset code'}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400 mt-2 mb-8">
              {step === 'request'
                ? "Enter your registered email address to receive a 6-digit verification code."
                : "Enter the 6-digit code sent to your email along with your new password."}
            </Text>

            {formError && (
              <View className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-3.5 mb-5">
                <Text className="text-sm text-red-600 dark:text-red-400">{formError}</Text>
              </View>
            )}

            {step === 'request' ? (
              /* Step 1: Email Form */
              <View>
                <View className="mb-6">
                  <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                    Registered Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setFormError(null);
                    }}
                    placeholder="you@domain.com"
                    placeholderTextColor="#6B6B6B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 text-base text-neutral-900 dark:text-white"
                  />
                </View>

                <Button label="Send 6-Digit Code" onPress={handleSendOtp} loading={isSubmitting} />
              </View>
            ) : (
              /* Step 2: Code + New Password */
              <View>
                <View className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 mb-5 flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Code sent to</Text>
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
                      {email}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setStep('request');
                      setCode('');
                      setFormError(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-primary/20"
                  >
                    <Text className="text-xs font-semibold text-primary">Change</Text>
                  </Pressable>
                </View>

                <View className="mb-4">
                  <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                    6-Digit Verification Code
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={(text) => {
                      setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                      setFormError(null);
                    }}
                    placeholder="• • • • • •"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    className="h-14 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 text-center text-2xl font-bold tracking-widest text-primary"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                    New Password
                  </Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={(t) => {
                      setNewPassword(t);
                      setFormError(null);
                    }}
                    placeholder="Min 8 characters"
                    placeholderTextColor="#6B6B6B"
                    secureTextEntry
                    autoComplete="new-password"
                    className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 text-base text-neutral-900 dark:text-white"
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                    Confirm New Password
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      setFormError(null);
                    }}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#6B6B6B"
                    secureTextEntry
                    autoComplete="new-password"
                    className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 text-base text-neutral-900 dark:text-white"
                  />
                </View>

                <Button label="Reset Password" onPress={handleResetPassword} loading={isSubmitting} />

                <View className="flex-row items-center justify-center mt-5">
                  <Pressable
                    onPress={cooldown === 0 ? handleSendOtp : undefined}
                    disabled={cooldown > 0 || isSubmitting}
                    className="flex-row items-center py-2 px-3"
                  >
                    <RefreshCw size={14} color={cooldown > 0 ? '#A3A3A3' : '#FF7A00'} />
                    <Text className={`text-sm font-medium ml-1.5 ${cooldown > 0 ? 'text-neutral-400' : 'text-primary'}`}>
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View className="mt-12 mb-6 items-center">
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Remember your password? <Text className="text-primary font-semibold">Log in</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
