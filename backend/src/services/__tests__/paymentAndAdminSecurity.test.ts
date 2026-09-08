import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  timingSafeCompare,
} from '../razorpayService.js';
import { createSubscriptionPaymentController } from '../../controllers/subscriptionPaymentController.js';
import { createRazorpayWebhookController } from '../../controllers/razorpayWebhookController.js';
import { createAdminController } from '../../controllers/adminController.js';
import { getAdminSecret, safeEqual } from '../../lib/auth.js';

describe('Payment & Admin Security Hardening Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constant-time Comparison & Signature Security', () => {
    it('safely compares equal strings without throwing or timing leaks', () => {
      expect(timingSafeCompare('secret_abc_123', 'secret_abc_123')).toBe(true);
      expect(safeEqual('secret_abc_123', 'secret_abc_123')).toBe(true);
    });

    it('rejects strings with differing lengths without crashing Buffer comparison', () => {
      expect(timingSafeCompare('short', 'much_longer_string')).toBe(false);
      expect(timingSafeCompare('', 'value')).toBe(false);
      expect(timingSafeCompare(undefined, 'value')).toBe(false);
      expect(safeEqual('short', 'much_longer_string')).toBe(false);
      expect(safeEqual(undefined, 'value')).toBe(false);
    });

    it('rejects invalid or tampered payment signature in verifyPaymentSignature', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
      process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_456';

      const orderId = 'order_123';
      const paymentId = 'pay_456';
      const validSig = crypto
        .createHmac('sha256', 'rzp_secret_456')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(verifyPaymentSignature(orderId, paymentId, validSig)).toBe(true);
      expect(verifyPaymentSignature(orderId, paymentId, 'tampered_sig')).toBe(false);
      expect(verifyPaymentSignature(orderId, paymentId, '')).toBe(false);
    });
  });

  describe('Multi-tenant IDOR Protection in verifyPayment', () => {
    it('rejects verification if order belongs to a different user (IDOR prevention)', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
      process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_456';

      const mockPrisma = {
        paymentOrder: {
          findUnique: vi.fn(() =>
            Promise.resolve({
              id: 'order_victim',
              userId: 'victim_user_999',
              planTier: 'PRO_MONTHLY',
              amountPaise: 29900,
              status: 'PENDING',
              razorpayOrderId: 'rzp_order_victim',
            })
          ),
        },
      } as any;

      const controller = createSubscriptionPaymentController(mockPrisma);
      const req = {
        userId: 'attacker_user_111',
        body: {
          orderId: 'order_victim',
          razorpayOrderId: 'rzp_order_victim',
          razorpayPaymentId: 'pay_dummy',
          razorpaySignature: 'sig_dummy',
        },
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              jsonBody = data;
            },
          };
        },
      } as any;

      await controller.verifyPayment(req, res);

      expect(statusCode).toBe(403);
      expect(jsonBody.error.code).toBe('FORBIDDEN');
      expect(jsonBody.error.message).toContain('not authorized');
    });

    it('rejects verification if signature is omitted when Razorpay is configured', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
      process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_456';

      const mockPrisma = {
        paymentOrder: {
          findUnique: vi.fn(() =>
            Promise.resolve({
              id: 'order_legit',
              userId: 'user_123',
              planTier: 'PRO_MONTHLY',
              amountPaise: 29900,
              status: 'PENDING',
            })
          ),
        },
      } as any;

      const controller = createSubscriptionPaymentController(mockPrisma);
      const req = {
        userId: 'user_123',
        body: {
          orderId: 'order_legit',
          razorpayPaymentId: 'pay_bypass_attempt',
          // razorpaySignature omitted!
        },
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              jsonBody = data;
            },
          };
        },
      } as any;

      await controller.verifyPayment(req, res);

      expect(statusCode).toBe(400);
      expect(jsonBody.error.code).toBe('SIGNATURE_REQUIRED');
    });
  });

  describe('Payment Callback Security', () => {
    it('strictly forbids mock=true in production', async () => {
      process.env.NODE_ENV = 'production';

      const mockPrisma = {
        paymentOrder: {
          update: vi.fn(),
        },
      } as any;

      const controller = createSubscriptionPaymentController(mockPrisma);
      const req = {
        query: {
          orderDbId: 'order_any',
          mock: 'true',
        },
      } as any;

      let statusCode = 200;
      let sentBody = '';
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            send: (data: any) => {
              sentBody = data;
            },
          };
        },
      } as any;

      await controller.paymentCallback(req, res);

      expect(statusCode).toBe(403);
      expect(sentBody).toContain('strictly disabled in production');
      expect(mockPrisma.paymentOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Fail-Closed Behavior in Production', () => {
    it('fails closed (500) if RAZORPAY_WEBHOOK_SECRET is unset in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const mockPrisma = {} as any;
      const webhookHandler = createRazorpayWebhookController(mockPrisma);

      const req = {
        headers: {},
        body: { event: 'payment.captured' },
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              jsonBody = data;
            },
          };
        },
      } as any;

      await webhookHandler(req, res);

      expect(statusCode).toBe(500);
      expect(jsonBody.error).toContain('not configured on server');
    });

    it('rejects webhooks with missing signature header when secret is configured', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = 'wh_secret_xyz';

      const mockPrisma = {} as any;
      const webhookHandler = createRazorpayWebhookController(mockPrisma);

      const req = {
        headers: {}, // No x-razorpay-signature header
        body: { event: 'payment.captured' },
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              jsonBody = data;
            },
          };
        },
      } as any;

      await webhookHandler(req, res);

      expect(statusCode).toBe(400);
      expect(jsonBody.error).toContain('Missing x-razorpay-signature header');
    });
  });

  describe('Admin Secret Hardening', () => {
    it('forbids default fallback secret in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_SECRET;

      expect(getAdminSecret()).toBeNull();

      process.env.ADMIN_SECRET = 'follope_superadmin_2026';
      expect(getAdminSecret()).toBeNull();

      process.env.ADMIN_SECRET = 'my_super_secure_production_admin_secret_999';
      expect(getAdminSecret()).toBe('my_super_secure_production_admin_secret_999');
    });

    it('rejects admin login in production if ADMIN_SECRET is not securely configured', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_SECRET;

      const mockPrisma = {} as any;
      const adminCtrl = createAdminController(mockPrisma);

      const req = {
        body: { secret: 'follope_superadmin_2026' },
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              jsonBody = data;
            },
          };
        },
      } as any;

      await adminCtrl.login(req, res);

      expect(statusCode).toBe(500);
      expect(jsonBody.error.code).toBe('CONFIGURATION_ERROR');
    });
  });
});
