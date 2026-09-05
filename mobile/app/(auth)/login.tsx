import { useState, useEffect } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck, RefreshCw } from 'lucide-react-native';
import { FormInput } from '../../components/FormInput';
import { Button } from '../../components/Button';
import { loginSchema, type LoginInput } from '../../lib/schemas';
import { api, ApiError } from '../../lib/api';
import { useAuthStore, type AuthUser } from '../../lib/authStore';
import { BrandLogo } from '../../components/BrandLogo';
import { useReadableContentWidth } from '../../lib/layout';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const contentStyle = useReadableContentWidth(480);

  const [authMode, setAuthMode] = useState<'otp' | 'password'>('password');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP State
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpName, setOtpName] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for OTP resends
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Password Form
  const { control, handleSubmit } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onPasswordSubmit = async (values: LoginInput) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        '/auth/login',
        values,
        { skipAuth: true }
      );
      await setSession(result.user, result.accessToken, result.refreshToken);
      router.replace('/(main)/home');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    const trimmedEmail = otpEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/otp/send', { email: trimmedEmail }, { skipAuth: true });
      setOtpStep('verify');
      setCooldown(60);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmedCode = otpCode.trim();
    if (trimmedCode.length !== 6) {
      setFormError('Please enter the 6-digit verification code');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        '/auth/otp/verify',
        {
          email: otpEmail.trim().toLowerCase(),
          code: trimmedCode,
          name: otpName.trim() || undefined,
        },
        { skipAuth: true }
      );
      await setSession(result.user, result.accessToken, result.refreshToken);
      router.replace('/(main)/home');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Invalid or expired code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerClassName="flex-grow px-6 pt-8 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View style={contentStyle} className="w-full">
            <BrandLogo width={120} height={38} />
            <Text className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mt-7">Welcome back</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 mt-2 mb-6">
              Sign in to manage invoices, payments, and follow-ups.
            </Text>

            {/* Auth Mode Toggle */}
            <View className="flex-row bg-neutral-100 dark:bg-card p-1 rounded-xl mb-6 border border-neutral-200 dark:border-border">
              <Pressable
                onPress={() => {
                  setAuthMode('otp');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg items-center justify-center flex-row gap-1.5 ${
                  authMode === 'otp' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''
                }`}
              >
                <ShieldCheck size={16} color={authMode === 'otp' ? '#FF7A00' : '#737373'} />
                <Text
                  className={`text-sm font-semibold ${
                    authMode === 'otp' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'
                  }`}
                >
                  Email OTP
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAuthMode('password');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg items-center justify-center flex-row gap-1.5 ${
                  authMode === 'password' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''
                }`}
              >
                <KeyRound size={16} color={authMode === 'password' ? '#FF7A00' : '#737373'} />
                <Text
                  className={`text-sm font-semibold ${
                    authMode === 'password' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'
                  }`}
                >
                  Password
                </Text>
              </Pressable>
            </View>

            {formError && (
              <View className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-3 mb-5">
                <Text className="text-sm text-red-600 dark:text-red-400">{formError}</Text>
              </View>
            )}

            {authMode === 'otp' ? (
              otpStep === 'request' ? (
                /* Step 1: Request OTP */
                <View>
                  <View className="mb-4">
                    <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">Email address</Text>
                    <TextInput
                      value={otpEmail}
                      onChangeText={(t) => {
                        setOtpEmail(t);
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
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-5 leading-5">
                    We&apos;ll send a 6-digit verification code to your email. Passwordless, secure, and fast.
                  </Text>
                  <Button label="Send Verification Code" onPress={handleSendOtp} loading={isSubmitting} />
                </View>
              ) : (
                /* Step 2: Verify OTP */
                <View>
                  <View className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 mb-5 flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">Verification code sent to</Text>
                      <Text className="text-sm font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
                        {otpEmail}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setOtpStep('request');
                        setOtpCode('');
                        setFormError(null);
                      }}
                      className="px-2 py-1 rounded bg-primary/20"
                    >
                      <Text className="text-xs font-semibold text-primary">Change</Text>
                    </Pressable>
                  </View>

                  <View className="mb-4">
                    <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                      Enter 6-Digit Code
                    </Text>
                    <TextInput
                      value={otpCode}
                      onChangeText={(text) => {
                        setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6));
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

                  <View className="mb-5">
                    <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 font-medium">
                      Your Name <Text className="text-neutral-400 font-normal">(Optional if you&apos;re new)</Text>
                    </Text>
                    <TextInput
                      value={otpName}
                      onChangeText={setOtpName}
                      placeholder="e.g. Rahul Sharma"
                      placeholderTextColor="#6B6B6B"
                      autoCapitalize="words"
                      className="h-12 rounded-xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border px-4 text-base text-neutral-900 dark:text-white"
                    />
                  </View>

                  <Button label="Verify & Sign In" onPress={handleVerifyOtp} loading={isSubmitting} />

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
              )
            ) : (
              /* Password Form */
              <View>
                <FormInput
                  control={control}
                  name="email"
                  label="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <FormInput
                  control={control}
                  name="password"
                  label="Password"
                  secureTextEntry
                  autoComplete="password"
                />

                <Button label="Log In" onPress={handleSubmit(onPasswordSubmit)} loading={isSubmitting} />

                <Pressable className="mt-4 items-center" onPress={() => router.push('/(auth)/forgot-password')}>
                  <Text className="text-primary text-sm">Forgot password?</Text>
                </Pressable>
              </View>
            )}

            <View className="mt-12 mb-6 items-center">
              <Pressable onPress={() => router.push('/(auth)/signup')}>
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Don&apos;t have an account? <Text className="text-primary font-semibold">Sign up</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
