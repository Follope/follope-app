import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { fulfillPayment, verifyWebhookSignature } from '../services/razorpayService.js';

export function createRazorpayWebhookController(prisma: PrismaClient) {
  return async function handleRazorpayWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      if (process.env.RAZORPAY_WEBHOOK_SECRET) {
        const isValid = verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          console.warn('Invalid Razorpay webhook signature');
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
