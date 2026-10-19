import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  createPaymentOrder,
  fulfillPayment,
  verifyPaymentSignature,
  isRazorpayConfigured,
} from '../services/razorpayService.js';
import { grantUserPlan } from '../services/subscriptionService.js';

export function createSubscriptionPaymentController(prisma: PrismaClient) {
  return {
    async createCheckout(req: Request, res: Response) {
      try {
        const userId = (req as any).userId || (req as any).user?.id;
        if (!userId) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        }

        const { planTier } = req.body;
        if (!planTier || !['PRO_MONTHLY', 'PRO_ANNUAL', 'LIFETIME'].includes(planTier)) {
          return res.status(400).json({
            error: { code: 'INVALID_INPUT', message: 'Valid planTier (PRO_MONTHLY, PRO_ANNUAL, LIFETIME) is required' },
          });
        }

        const session = await createPaymentOrder(prisma, {
          userId,
          planTier,
        });

        return res.json({ data: session });
      } catch (err: any) {
        console.error('Error creating subscription checkout:', err);
        return res.status(500).json({
          error: { code: 'CHECKOUT_FAILED', message: err.message || 'Could not initiate checkout' },
        });
      }
    },

    async verifyPayment(req: Request, res: Response) {
      try {
        const userId = (req as any).userId || (req as any).user?.id;
        if (!userId) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        }

        const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        if (!orderId || !razorpayPaymentId) {
          return res.status(400).json({
            error: { code: 'INVALID_INPUT', message: 'orderId and razorpayPaymentId are required' },
          });
        }

        // Multi-tenant IDOR protection: Verify payment order exists and belongs to authenticated user
        const order = await prisma.paymentOrder.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          return res.status(404).json({
            error: { code: 'ORDER_NOT_FOUND', message: 'Payment order not found' },
          });
        }

        if (order.userId !== userId) {
          return res.status(403).json({
            error: { code: 'FORBIDDEN', message: 'You are not authorized to verify this payment order' },
          });
        }

        if (!order.razorpayOrderId || razorpayOrderId !== order.razorpayOrderId) {
          return res.status(400).json({
            error: { code: 'ORDER_MISMATCH', message: 'Payment does not belong to this checkout order' },
          });
        }

        // Mandatory signature verification whenever Razorpay is configured or running in production
        const enforceSignature = isRazorpayConfigured() || process.env.NODE_ENV === 'production';
        if (enforceSignature) {
          if (!razorpaySignature || !razorpayOrderId) {
            return res.status(400).json({
              error: {
                code: 'SIGNATURE_REQUIRED',
                message: 'razorpayOrderId and razorpaySignature are required for payment verification',
              },
            });
          }

          const isValid = verifyPaymentSignature(order.razorpayOrderId, razorpayPaymentId, razorpaySignature);
          if (!isValid) {
            return res.status(400).json({
              error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' },
            });
          }
        } else {
          // In development sandbox mode without Razorpay API keys:
          if (razorpaySignature && razorpayOrderId) {
            const isValid = verifyPaymentSignature(order.razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
              return res.status(400).json({
                error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' },
              });
            }
          } else if (!razorpayPaymentId.startsWith('mock_')) {
            return res.status(400).json({
              error: { code: 'SIGNATURE_REQUIRED', message: 'Signature verification required' },
            });
          }
        }

        const result = await fulfillPayment(prisma, {
          paymentOrderId: order.id,
          razorpayOrderId: razorpayOrderId || order.razorpayOrderId || undefined,
          razorpayPaymentId,
          razorpaySignature,
        });

        return res.json({ data: result });
      } catch (err: any) {
        console.error('Error verifying payment:', err);
        return res.status(500).json({
          error: { code: 'VERIFICATION_FAILED', message: err.message || 'Payment verification failed' },
        });
      }
    },

    async syncIap(req: Request, res: Response) {
      try {
        const userId = (req as any).userId || (req as any).user?.id;
        if (!userId) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        }

        const { planTier, productId, transactionId } = req.body;
        if (!planTier || !['PRO_MONTHLY', 'PRO_ANNUAL', 'LIFETIME'].includes(planTier)) {
          return res.status(400).json({
            error: { code: 'INVALID_INPUT', message: 'Valid planTier (PRO_MONTHLY, PRO_ANNUAL, LIFETIME) is required' },
          });
        }

        const durationDays = planTier === 'PRO_MONTHLY' ? 30 : planTier === 'PRO_ANNUAL' ? 365 : undefined;
        const sub = await grantUserPlan(prisma, userId, planTier, durationDays);

        return res.json({ data: { success: true, subscription: sub } });
      } catch (err: any) {
        console.error('Error syncing IAP subscription:', err);
        return res.status(500).json({
          error: { code: 'IAP_SYNC_FAILED', message: err.message || 'Failed to sync IAP subscription' },
        });
      }
    },

    async paymentCallback(req: Request, res: Response) {
      const orderDbId = req.query.orderDbId as string;
      // Payment Links redirect the browser here, but only the signed webhook
      // may grant a subscription. URL parameters are not proof of payment.
      const order = orderDbId
        ? await prisma.paymentOrder.findUnique({ where: { id: orderDbId }, select: { status: true } }).catch(() => null)
        : null;
      const succeeded = order?.status === 'SUCCESS';

      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"
      );
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${succeeded ? 'Payment Successful' : 'Payment Processing'} - Follope Pro</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-2xl">
    <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-2xl font-bold mb-2">${succeeded ? 'Payment Successful!' : 'Payment is processing'}</h1>
    <p class="text-neutral-400 text-sm mb-6">
      ${succeeded
        ? 'Your Follope Pro subscription is active.'
        : 'We are waiting for secure confirmation from the payment provider. Your plan will update after the signed webhook is processed.'}
    </p>
    <a href="follope://subscription-success" class="inline-flex items-center justify-center w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg transition-colors">
      Open Follope App
    </a>
    <p class="text-xs text-neutral-500 mt-4">
      If the app didn't open automatically, click the button above.
    </p>
  </div>
</body>
</html>`);
    },
  };
}
