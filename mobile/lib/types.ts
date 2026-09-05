export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  gstin?: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unitPricePaise: number;
  discountPaise: number;
  taxRateBps: number;
  lineTotalPaise: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  publicToken: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  notes?: string | null;
  client: Client;
  items: InvoiceItem[];
  createdAt: string;
  sentAt?: string | null;
  publicLinkExpiresAt?: string | null;
  publicLinkRevokedAt?: string | null;
  revisions?: InvoiceRevision[];
}

export interface InvoiceRevision {
  id: string;
  version: number;
  reason?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  amountPaise: number;
  method: 'UPI' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  paidAt: string;
  referenceId?: string | null;
  notes?: string | null;
  reconciledAt?: string | null;
}

export interface DashboardData {
  outstandingPaise: number;
  thisMonthPaise: number;
  invoiceCount: number;
  recentInvoices: Invoice[];
}

export interface CashFlowAnalytics {
  months: Array<{ label: string; receivedPaise: number; invoicedPaise: number }>;
  overdue: { count: number; amountPaise: number };
}

export interface Business {
  businessName?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  website?: string | null;
  upiId?: string | null;
  invoicePrefix: string;
  defaultDuePeriodDays: number;
  defaultTaxRateBps?: number | null;
  defaultInvoiceNotes?: string | null;
}

export interface FollopeNotification {
  id: string;
  userId: string;
  type: string;
  payload: {
    invoiceId?: string;
    invoiceNumber?: string;
    clientId?: string;
    clientName?: string;
    clientPhone?: string | null;
    balancePaise?: number;
    dueDate?: string;
    daysOverdue?: number;
    whatsappMessage?: string;
    whatsappUrl?: string | null;
    title?: string;
    body?: string;
  } | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationResponse {
  items: FollopeNotification[];
  unreadCount: number;
  summary?: {
    checkedCount: number;
    newNotificationsCount: number;
  };
}

