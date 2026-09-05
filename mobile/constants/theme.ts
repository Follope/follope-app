/**
 * Follope design tokens. Single source of truth for colors — used both
 * directly in components (via these constants) and mirrored into
 * tailwind.config.js so NativeWind classes stay in sync with this file.
 * If you change a value here, update tailwind.config.js to match.
 */
export const colors = {
  primary: '#FF7A00',
  primaryDark: '#D65D00',
  primaryLight: '#FF9933',

  background: '#0A0A0A',
  card: '#121212',
  border: '#242424',

  textPrimary: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textMuted: '#6B6B6B',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  statusPaid: '#22C55E',
  statusPending: '#F59E0B',
  statusOverdue: '#EF4444',
  statusDraft: '#6B6B6B',
  statusPartiallyPaid: '#3B82F6',
  statusCancelled: '#6B6B6B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export function statusColor(status: string): string {
  switch (status) {
    case 'PAID':
      return colors.statusPaid;
    case 'PENDING':
    case 'SENT':
    case 'VIEWED':
      return colors.statusPending;
    case 'OVERDUE':
      return colors.statusOverdue;
    case 'PARTIALLY_PAID':
      return colors.statusPartiallyPaid;
    case 'CANCELLED':
      return colors.statusCancelled;
    case 'DRAFT':
    default:
      return colors.statusDraft;
  }
}
