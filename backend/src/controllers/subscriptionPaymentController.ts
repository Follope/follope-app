import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  createPaymentOrder,
  fulfillPayment,
  verifyPaymentSignature,
} from '../services/razorpayService.js';

export function createSubscriptionPaymentController(prisma: PrismaClient) {
  return {
    async createCheckout(req: Request, res: Response) {
      try {
        const userId = (req as any).userId || (req as any).user?.id;
        if (!userId) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        }

        const { planTier, callbackUrl } = req.body;
        if (!planTier || !['PRO_MONTHLY', 'PRO_ANNUAL', 'LIFETIME'].includes(planTier)) {
          return res.status(400).json({
            error: { code: 'INVALID_INPUT', message: 'Valid planTier (PRO_MONTHLY, PRO_ANNUAL, LIFETIME) is required' },
          });
        }

        const session = await createPaymentOrder(prisma, {
          userId,
          planTier,
          callbackUrl,
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

        if (razorpaySignature && razorpayOrderId) {
          const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
          if (!isValid) {
            return res.status(400).json({
              error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' },
            });
          }
        }

        const result = await fulfillPayment(prisma, {
          paymentOrderId: orderId,
          razorpayOrderId,
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

    async paymentCallback(req: Request, res: Response) {
      const orderDbId = req.query.orderDbId as string;
      const mock = req.query.mock === 'true';
      const rzpPaymentId = (req.query.razorpay_payment_id as string) || (mock ? `mock_pay_${Date.now()}` : null);
      const rzpSignature = req.query.razorpay_signature as string;

      if (orderDbId && rzpPaymentId) {
        try {
          await fulfillPayment(prisma, {
            paymentOrderId: orderDbId,
            razorpayPaymentId: rzpPaymentId,
            razorpaySignature: rzpSignature,
          });
        } catch (err) {
          console.error('Auto-fulfillment on callback error:', err);
        }
      }

      res.setHeader('Content-Type', 'text/html');
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - Follope Pro</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-2xl">
    <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-2xl font-bold mb-2">🎉 Payment Successful!</h1>
    <p class="text-neutral-400 text-sm mb-6">
      Your Follope Pro subscription is now active. You have unlocked unlimited invoices and all Pro features!
    </p>
    <a href="follope://subscription-success" class="inline-flex items-center justify-center w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg transition-colors">
      Open Follope App
    </a>
    <p class="text-xs text-neutral-500 mt-4">
      If the app didn't open automatically, click the button above.
    </p>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = 'follope://subscription-success';
    }, 1500);
  </script>
</body>
</html>`);
    },
  };
}
