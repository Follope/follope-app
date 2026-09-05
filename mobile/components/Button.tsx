import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary active:bg-primary-dark', text: 'text-white' },
  secondary: { bg: 'bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border active:bg-border', text: 'text-neutral-900 dark:text-white' },
  ghost: { bg: 'bg-transparent active:bg-neutral-50 dark:bg-card', text: 'text-primary' },
  danger: { bg: 'bg-red-600 active:bg-red-700', text: 'text-white' },
};

/**
 * Primary CTA button, sized for comfortable mobile tapping (min 48px
 * height, per spec section 39's "large touch targets" requirement).
 */
export function Button({ label, variant = 'primary', loading, disabled, className, ...pressableProps }: ButtonProps) {
  const isDisabled = disabled || loading;
  const styles = variantStyles[variant];

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      className={`h-12 rounded-xl items-center justify-center px-6 ${styles.bg} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#FF7A00' : '#FFFFFF'} />
      ) : (
        <Text className={`text-base font-semibold ${styles.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
