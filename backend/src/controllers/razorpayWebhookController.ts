import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { fulfillPayment, verifyWebhookSignature } from '../services/razorpayService.js';

export function createRazorpayWebhookController(prisma: PrismaClient) {
  return async function handleRazorpayWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
      const isProduction = process.env.NODE_ENV === 'production';

      // Security Check: In production, webhook secret MUST be set; fail-closed if missing
      if (!webhookSecret) {
        if (isProduction) {
          console.error('CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured in production.');
          return res.status(500).json({ error: 'Webhook signature verification is not configured on server' });
        }
      } else {
        // When secret is configured, header is mandatory and must match HMAC
        if (!signature) {
          return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
        }

        const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          console.warn('Invalid Razorpay webhook signature rejected.');
          return res.status(400).json({ error: 'Invalid webhook signature' });
        }
      }

      const event = req.body?.event;
      const payload = req.body?.payload;

      console.log(`Received Razorpay webhook event: ${event}`);

      if (
        event === 'payment_link.paid' ||
        event === 'payment.captured' ||
        event === 'order.paid'
      ) {
        const paymentEntity =
          payload?.payment?.entity ||
          payload?.payment_link?.entity;

        const razorpayPaymentId = paymentEntity?.id;
        const razorpayOrderId = paymentEntity?.order_id || payload?.payment_link?.entity?.id;
        const orderDbId = paymentEntity?.notes?.orderDbId;

        if (razorpayPaymentId && (orderDbId || razorpayOrderId)) {
          await fulfillPayment(prisma, {
            paymentOrderId: orderDbId,
            razorpayOrderId,
            razorpayPaymentId,
          });
          console.log(`Razorpay payment fulfilled successfully for paymentId: ${razorpayPaymentId}`);
        }
      }

      return res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('Error handling Razorpay webhook:', err);
      return res.status(200).json({ status: 'error_handled', message: err.message });
    }
  };
}
