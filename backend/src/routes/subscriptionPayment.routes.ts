import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';
import { createSubscriptionPaymentController } from '../controllers/subscriptionPaymentController.js';
import { createRazorpayWebhookController } from '../controllers/razorpayWebhookController.js';

export function createSubscriptionPaymentRouter(prisma: PrismaClient) {
  const router = Router();
  const controller = createSubscriptionPaymentController(prisma);

  // Authenticated endpoints for mobile app
  router.post('/create-checkout', requireAuth, controller.createCheckout);
  router.post('/verify-payment', requireAuth, controller.verifyPayment);

  // Public callback URL redirected from payment gateway
  router.get('/payment-callback', controller.paymentCallback);

  return router;
}

export function createWebhookRouter(prisma: PrismaClient) {
  const router = Router();
  const webhookHandler = createRazorpayWebhookController(prisma);

  router.post('/razorpay', webhookHandler);

  return router;
}
