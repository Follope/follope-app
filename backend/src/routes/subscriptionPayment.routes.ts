import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createSubscriptionPaymentController } from '../controllers/subscriptionPaymentController.js';
import { createRazorpayWebhookController } from '../controllers/razorpayWebhookController.js';

export function createSubscriptionPaymentRouter(prisma: PrismaClient) {
  const router = Router();
  const controller = createSubscriptionPaymentController(prisma);

  const checkoutRateLimit = rateLimit({ windowMs: 60_000, max: 10 });
  const verifyRateLimit = rateLimit({ windowMs: 60_000, max: 15 });
  const callbackRateLimit = rateLimit({ windowMs: 60_000, max: 20 });

  // Authenticated endpoints for mobile app
  router.post('/create-checkout', requireAuth, checkoutRateLimit, controller.createCheckout);
  router.post('/verify-payment', requireAuth, verifyRateLimit, controller.verifyPayment);

  // Public callback URL redirected from payment gateway
  router.get('/payment-callback', callbackRateLimit, controller.paymentCallback);

  return router;
}

export function createWebhookRouter(prisma: PrismaClient) {
  const router = Router();
  const webhookHandler = createRazorpayWebhookController(prisma);
  const webhookRateLimit = rateLimit({ windowMs: 60_000, max: 60 });

  router.post('/razorpay', webhookRateLimit, webhookHandler);

  return router;
}
