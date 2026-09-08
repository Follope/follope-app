import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  createPaymentOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fulfillPayment,
} from '../razorpayService.js';

describe('Razorpay Payment Gateway Service Tests', () => {
  const secretKey = 'test_rzp_secret_xyz123';

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key123';
    process.env.RAZORPAY_KEY_SECRET = secretKey;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_789';
  });

  describe('Payment Signature Verification', () => {
    it('correctly verifies a valid HMAC-SHA256 signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = verifyPaymentSignature(orderId, paymentId, expectedSignature);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid or tampered signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const fakeSignature = 'bogus_signature_abc_123';

      const isValid = verifyPaymentSignature(orderId, paymentId, fakeSignature);
      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Signature Verification', () => {
    it('verifies valid webhook signature from raw request body', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', payload: { id: '123' } });
      const webhookSecret = 'webhook_secret_789';
      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const isValid = verifyWebhookSignature(rawBody, validSignature, webhookSecret);
      expect(isValid).toBe(true);
    });

    it('rejects webhook payload if signature is tampered', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const isValid = verifyWebhookSignature(rawBody, 'tampered_sig', 'webhook_secret_789');
      expect(isValid).toBe(false);
    });
  });

  describe('Order Creation', () => {
    it('creates a pending payment order with the correct plan pricing in paise', async () => {
      const mockConfig = {
        id: 'default',
        freeInvoiceLimit: 3,
        freeMaxInvoiceEdits: 1,
        referralRewardMonths: 1,
        proMonthlyPricePaise: 29900,
        proAnnualPricePaise: 249900,
        lifetimePricePaise: 499900,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn(() => Promise.resolve({ id: 'u_1', name: 'Rahul K', email: 'rahul@example.com' })),
        },
        planConfig: {
          findUnique: vi.fn(() => Promise.resolve(mockConfig)),
        },
        paymentOrder: {
          create: vi.fn(({ data }) => Promise.resolve({ id: 'po_123', ...data })),
          update: vi.fn(({ data }) => Promise.resolve({ id: 'po_123', ...data })),
        },
      } as any;

      const result = await createPaymentOrder(mockPrisma, {
        userId: 'u_1',
        planTier: 'PRO_ANNUAL',
      });

      expect(result.orderId).toBe('po_123');
      expect(result.amountPaise).toBe(249900);
      expect(result.currency).toBe('INR');
      expect(result.planTier).toBe('PRO_ANNUAL');
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u_1',
            planTier: 'PRO_ANNUAL',
            amountPaise: 249900,
            status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('Payment Fulfillment', () => {
    it('activates Pro subscription and marks payment order as SUCCESS', async () => {
      const pendingOrder = {
        id: 'po_999',
        userId: 'u_10',
        planTier: 'PRO_MONTHLY',
        amountPaise: 29900,
        status: 'PENDING',
        razorpayOrderId: 'order_rzp_999',
      };

      const mockPrisma = {
        paymentOrder: {
          findUnique: vi.fn(() => Promise.resolve(pendingOrder)),
          update: vi.fn(({ data }) => Promise.resolve({ ...pendingOrder, ...data })),
        },
        subscription: {
          findUnique: vi.fn(() => Promise.resolve(null)),
          upsert: vi.fn(({ create }) => Promise.resolve({ id: 'sub_999', ...create })),
        },
        notification: {
          create: vi.fn(() => Promise.resolve({ id: 'notif_1' })),
        },
      } as any;

      const fulfillment = await fulfillPayment(mockPrisma, {
        paymentOrderId: 'po_999',
        razorpayPaymentId: 'pay_complete_123',
        razorpaySignature: 'sig_123',
      });

      expect(fulfillment.success).toBe(true);
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po_999' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            razorpayPaymentId: 'pay_complete_123',
          }),
        })
      );
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u_10' },
          create: expect.objectContaining({
            userId: 'u_10',
            tier: 'PRO_MONTHLY',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('handles duplicate fulfillment calls idempotently without duplicate charges or updates', async () => {
      const alreadySuccessfulOrder = {
        id: 'po_already_paid',
        userId: 'u_10',
        planTier: 'PRO_MONTHLY',
        status: 'SUCCESS',
        razorpayPaymentId: 'pay_existing_123',
      };

      const mockPrisma = {
        paymentOrder: {
          findUnique: vi.fn(() => Promise.resolve(alreadySuccessfulOrder)),
          update: vi.fn(),
        },
        subscription: {
          upsert: vi.fn(),
        },
      } as any;

      const res = await fulfillPayment(mockPrisma, {
        paymentOrderId: 'po_already_paid',
        razorpayPaymentId: 'pay_existing_123',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('already processed');
      expect(mockPrisma.paymentOrder.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });
  });
});
