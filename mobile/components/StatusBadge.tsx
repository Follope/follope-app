import { View, Text } from 'react-native';
import { statusColor } from '../constants/theme';
import type { InvoiceStatus } from '../lib/types';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const color = statusColor(status);
  return (
    <View
      className="px-2.5 py-1 rounded-full self-start"
      style={{ backgroundColor: `${color}22` }} // ~13% opacity tint of the status color
    >
      <Text className="text-xs font-medium" style={{ color }}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
