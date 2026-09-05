import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPushService, isExpoPushToken } from '../pushService.js';
import type { PrismaClient } from '@prisma/client';

describe('pushService', () => {
  describe('isExpoPushToken', () => {
    it('validates standard ExponentPushToken format', () => {
      expect(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
      expect(isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
      expect(isExpoPushToken('12345678-1234-1234-1234-123456789012')).toBe(true);
    });

    it('rejects invalid tokens', () => {
      expect(isExpoPushToken('')).toBe(false);
      expect(isExpoPushToken(null)).toBe(false);
      expect(isExpoPushToken(undefined)).toBe(false);
      expect(isExpoPushToken('short')).toBe(false);
    });
  });

  describe('sendDirect', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.restoreAllMocks();
    });

    it('returns error if token is invalid without calling fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const service = createPushService(mockPrisma as PrismaClient);

      const result = await service.sendDirect({
        to: 'invalid-token',
        title: 'Test',
        body: 'Test Body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends payload to Expo Push API when token is valid', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok', id: 'ticket-123' }],
        }),
      } as any);

      const service = createPushService(mockPrisma as PrismaClient);
      const result = await service.sendDirect({
        to: 'ExponentPushToken[valid-test-token-1234567890]',
        title: 'Payment Alert',
        body: 'Invoice FOL-001 viewed',
        data: { invoiceId: 'inv-123' },
      });

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe('ticket-123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('sendToUser', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.restoreAllMocks();
    });

    it('returns NO_PUSH_TOKEN if user has no registered token', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ pushToken: null });
      const service = createPushService(mockPrisma as PrismaClient);

      const result = await service.sendToUser('user-1', {
        title: 'Test',
        body: 'Message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_PUSH_TOKEN');
    });

    it('cleans up pushToken if DeviceNotRegistered error is returned', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        pushToken: 'ExponentPushToken[unregistered-token-12345]',
      });
      mockPrisma.user.update.mockResolvedValueOnce({ id: 'user-1' });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } }],
        }),
      } as any);

      const service = createPushService(mockPrisma as PrismaClient);
      const result = await service.sendToUser('user-1', {
        title: 'Test',
        body: 'Message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DeviceNotRegistered');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pushToken: null },
      });
    });
  });
});
