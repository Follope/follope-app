import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, newIdempotencyKey } from './api';
import { downloadAndShareAccountingReport, downloadAndShareInvoicePdf } from './invoicePdf';
import type { Client, Invoice, DashboardData, Payment, Business, CashFlowAnalytics, NotificationResponse } from './types';
import type { ClientInput, CreateInvoiceInput, RecordPaymentInput, BusinessInput } from './schemas';

// --- Clients ---------------------------------------------------------------

export function useClients(search?: string) {
  return useQuery({
    queryKey: ['clients', search ?? ''],
    queryFn: () => api.get<Client[]>(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => api.post<Client>('/clients', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClientInput>) => api.patch<Client>(`/clients/${id}`, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['clients', id], updated);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ success: boolean }>(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// --- Invoices ----------------------------------------------------------------

export function useInvoices(filters?: { status?: string; clientId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  const qs = params.toString();

  return useQuery({
    queryKey: ['invoices', filters ?? {}],
    queryFn: () => api.get<Invoice[]>(`/invoices${qs ? `?${qs}` : ''}`),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      // Idempotency-Key means a double-tap on "Create Invoice" (e.g. a slow
      // network causing the user to tap twice) returns the same invoice
      // instead of creating two. Generated fresh per mutate() call — a
      // deliberate user-initiated retry after a failure gets a new key
      // (and correctly creates a new attempt), while React Query's own
      // internal retry of the same call (if configured) would reuse it.
      api.post<Invoice>('/invoices', input, { headers: { 'Idempotency-Key': newIdempotencyKey() } }),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['invoices', invoice.id], invoice);
    },
  });
}

export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      api.post<{ payment: Payment; invoice: Invoice }>(`/invoices/${invoiceId}/payments`, input),
    onSuccess: ({ invoice }) => {
      queryClient.setQueryData(['invoices', invoiceId], invoice);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function usePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', invoiceId, 'payments'],
    queryFn: () => api.get<Payment[]>(`/invoices/${invoiceId}/payments`),
    enabled: Boolean(invoiceId),
  });
}

export function useShareInvoice(invoiceId: string) {
  return useMutation<{ publicUrl: string; expiresAt: string }, ApiError, number>({
    mutationFn: (expiresInDays) => api.post<{ publicUrl: string; expiresAt: string }>(`/invoices/${invoiceId}/share`, { expiresInDays }),
  });
}

export function useRevokeInvoiceLink(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>(`/invoices/${invoiceId}/revoke-link`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', invoiceId] }),
  });
}

export function useUpdateInvoice(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput & { reason?: string }) => api.patch<Invoice>(`/invoices/${invoiceId}`, input),
    onSuccess: (invoice) => {
      queryClient.setQueryData(['invoices', invoiceId], invoice);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDuplicateInvoice(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Invoice>(`/invoices/${invoiceId}/duplicate`),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['invoices', invoice.id], invoice);
    },
  });
}

export function useSendReminder(invoiceId: string) {
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; reminderText: string }>(`/invoices/${invoiceId}/reminder`),
  });
}

export function useCancelInvoice(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Invoice>(`/invoices/${invoiceId}/cancel`),
    onSuccess: (invoice) => {
      queryClient.setQueryData(['invoices', invoiceId], invoice);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDownloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
  return useMutation({
    mutationFn: () => downloadAndShareInvoicePdf(invoiceId, invoiceNumber),
  });
}

export function useDownloadAccountingReport() {
  return useMutation({ mutationFn: (format: 'csv' | 'pdf') => downloadAndShareAccountingReport(format) });
}

// --- Dashboard ---------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
  });
}

export function useCashFlowAnalytics() {
  return useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: () => api.get<CashFlowAnalytics>('/dashboard/analytics?months=6'),
  });
}

// --- Business settings ---------------------------------------------------------------

export function useBusiness() {
  return useQuery({
    queryKey: ['business'],
    queryFn: () => api.get<Business>('/me/business'),
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessInput) => api.patch<Business>('/me/business', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
    },
  });
}

// --- Notifications & Follow-Up Reminders -------------------------------------

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationResponse>('/notifications'),
    refetchInterval: 60_000, // Refresh once every minute
  });
}

export function useCheckReminders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<NotificationResponse>('/notifications/check'),
    onSuccess: (data) => {
      queryClient.setQueryData(['notifications'], data);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.patch<{ success: boolean }>(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ markedCount: number }>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useSavePushToken() {
  return useMutation({
    mutationFn: (pushToken: string) =>
      api.post<{ success: boolean }>('/notifications/push-token', { pushToken }),
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: boolean; message: string }>('/notifications/test-push'),
  });
}


