import { describe, it, expect, vi } from 'vitest';
import { createReminderService } from '../reminderService.js';

describe('reminderService', () => {
  it('detects overdue invoices, marks status as OVERDUE, and creates notifications with WhatsApp message', async () => {
    const pastDueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    const mockPrisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'inv_1',
            userId: 'user_1',
            invoiceNumber: 'FOL-001',
            publicToken: 'token_abc',
            status: 'SENT',
            dueDate: pastDueDate,
            balancePaise: 2500000, // ₹25,000
            clientId: 'client_1',
            client: {
              id: 'client_1',
              name: 'Amit Patel',
              phone: '9876543210',
            },
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif_1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = createReminderService(mockPrisma);
    const result = await service.checkOverdueInvoices('user_1');

    expect(result.checkedCount).toBe(1);
    expect(result.newNotificationsCount).toBe(1);
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: 'OVERDUE' },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        type: 'invoice_overdue',
        payload: expect.objectContaining({
          invoiceNumber: 'FOL-001',
          clientName: 'Amit Patel',
          daysOverdue: 3,
          whatsappUrl: expect.stringContaining('https://wa.me/919876543210?text='),
        }),
      }),
    });
  });

  it('marks notifications as read', async () => {
    const mockPrisma = {
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = createReminderService(mockPrisma);
    const marked = await service.markAsRead('user_1', 'notif_1');
    expect(marked).toBe(true);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif_1', userId: 'user_1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('triggers push notification to user when overdue invoices are detected', async () => {
    const pastDueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ pushToken: 'ExponentPushToken[user-push-token-123]' }),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'inv_2',
            userId: 'user_1',
            invoiceNumber: 'FOL-002',
            publicToken: 'token_xyz',
            status: 'SENT',
            dueDate: pastDueDate,
            balancePaise: 100000,
            clientId: 'client_2',
            client: { id: 'client_2', name: 'Sara Khan', phone: null },
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif_2', ...data })),
      },
    } as any;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-999' }] }),
    } as any);

    const service = createReminderService(mockPrisma);
    await service.checkOverdueInvoices('user_1');

    // Wait microtask for background dispatch
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      select: { pushToken: true },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});

