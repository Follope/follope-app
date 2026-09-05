import { useState, useEffect } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { FormInput } from '../../components/FormInput';
import { Button } from '../../components/Button';
import { registerSchema, type RegisterInput } from '../../lib/schemas';
import { api, ApiError } from '../../lib/api';
import { useAuthStore, type AuthUser } from '../../lib/authStore';
import { BrandLogo } from '../../components/BrandLogo';
import { useReadableContentWidth } from '../../lib/layout';

export default function SignupScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const contentStyle = useReadableContentWidth(480);

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Stored values from Step 1 to send with OTP verification in Step 2
  const [registrationData, setRegistrationData] = useState<RegisterInput | null>(null);

  // 60-second cooldown timer for resends
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const { control, handleSubmit, getValues } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  // Step 1: Validate form & send registration OTP
  const onSendOtp = async (values: RegisterInput) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post(
        '/auth/register/send-otp',
        { name: values.name.trim(), email: values.email.trim().toLowerCase() },
        { skipAuth: true }
      );
      setRegistrationData(values);
      setStep('verify');
      setCooldown(60);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP code & complete account registration
  const onVerifyAndRegister = async () => {
    if (!registrationData) return;
    const trimmedCode = otpCode.trim();
    if (trimmedCode.length !== 6) {
      setFormError('Please enter the 6-digit verification code');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        '/auth/register/verify',
        {
          name: registrationData.name.trim(),
          email: registrationData.email.trim().toLowerCase(),
          password: registrationData.password,
          code: trimmedCode,
        },
        { skipAuth: true }
      );
      await setSession(result.user, result.accessToken, result.refreshToken);
      router.replace('/(onboarding)/role');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Invalid or expired code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (!registrationData || cooldown > 0) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post(
        '/auth/register/send-otp',
        { name: registrationData.name.trim(), email: registrationData.email.trim().toLowerCase() },
        { skipAuth: true }
      );
      setCooldown(60);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to resend code. Please try again.');
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
            <Text className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mt-7">
              {step === 'form' ? 'Create your account' : 'Verify your email'}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400 mt-2 mb-8">
              {step === 'form'
                ? 'Join independent freelancers getting paid faster across India.'
                : `We emailed a 6-digit verification code to confirm your email.`}
            </Text>

            {formError && (
              <View className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-3.5 mb-5">
                <Text className="text-sm text-red-600 dark:text-red-400">{formError}</Text>
              </View>
            )}

            {step === 'form' ? (
              /* Step 1: Input Name, Email, Password */
              <View>
                <FormInput control={control} name="name" label="Full Name" autoComplete="name" />
                <FormInput
                  control={control}
                  name="email"
                  label="Email Address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <FormInput
                  control={control}
                  name="password"
                  label="Password (min 8 characters)"
                  secureTextEntry
                  autoComplete="new-password"
                />

                <Button label="Continue & Verify Email" onPress={handleSubmit(onSendOtp)} loading={isSubmitting} />

                <Pressable className="mt-5 items-center" onPress={() => router.push('/(auth)/login')}>
                  <Text className="text-primary text-sm font-medium">Prefer passwordless? Sign in with Email OTP</Text>
                </Pressable>
              </View>
            ) : (
              /* Step 2: Enter 6-Digit OTP */
              <View>
                <View className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 mb-5 flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Verification code sent to</Text>
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
                      {registrationData?.email}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setStep('form');
                      setOtpCode('');
                      setFormError(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-primary/20"
                  >
                    <Text className="text-xs font-semibold text-primary">Change</Text>
                  </Pressable>
                </View>

                <View className="mb-5">
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

                <Button label="Verify & Create Account" onPress={onVerifyAndRegister} loading={isSubmitting} />

                <View className="flex-row items-center justify-center mt-5">
                  <Pressable
                    onPress={cooldown === 0 ? handleResendOtp : undefined}
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
                  Already have an account? <Text className="text-primary font-semibold">Log in</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
