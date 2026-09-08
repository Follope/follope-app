import crypto from 'node:crypto';
import type { PrismaClient, PlanTier, PaymentOrder } from '@prisma/client';
import { getPlanConfig } from './planConfigService.js';
import { grantUserPlan } from './subscriptionService.js';

export interface CreateCheckoutInput {
  userId: string;
  planTier: 'PRO_MONTHLY' | 'PRO_ANNUAL' | 'LIFETIME';
  callbackUrl?: string;
}

export interface CheckoutSessionResult {
  orderId: string;
  razorpayOrderId: string | null;
  paymentUrl: string;
  amountPaise: number;
  currency: string;
  keyId: string | null;
  planTier: PlanTier;
}

export interface VerifyPaymentInput {
  orderId: string; // Database PaymentOrder.id
  razorpayOrderId?: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}

export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}

export function getRazorpayKeySecret(): string | null {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || null;
}

export function getRazorpayWebhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
}

/**
 * Creates a pending PaymentOrder and generates a Razorpay checkout payment link.
 */
export async function createPaymentOrder(
  prisma: PrismaClient,
  input: CreateCheckoutInput
): Promise<CheckoutSessionResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const config = await getPlanConfig(prisma);

  let amountPaise = 29900;
  let planLabel = 'Pro Monthly';

  if (input.planTier === 'PRO_ANNUAL') {
    amountPaise = config.proAnnualPricePaise ?? 249900;
    planLabel = 'Pro Annual';
  } else if (input.planTier === 'LIFETIME') {
    amountPaise = config.lifetimePricePaise ?? 499900;
    planLabel = 'Lifetime Pass';
  } else {
    amountPaise = config.proMonthlyPricePaise ?? 29900;
    planLabel = 'Pro Monthly';
  }

  // Create PENDING PaymentOrder in database
  const paymentOrder = await prisma.paymentOrder.create({
    data: {
      userId: user.id,
      planTier: input.planTier,
      amountPaise,
      currency: 'INR',
      status: 'PENDING',
      notes: {
        planLabel,
        userEmail: user.email,
        userName: user.name,
      },
    },
  });

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const apiBase = process.env.PUBLIC_API_URL || 'https://api.follope.com';
  const defaultCallback = `${apiBase}/v1/subscriptions/payment-callback?orderDbId=${paymentOrder.id}`;
  const callbackUrl = input.callbackUrl || defaultCallback;

  // If Razorpay API credentials are configured, call Razorpay Payment Links API
  if (keyId && keySecret) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          accept_partial: false,
          description: `Follope Pro - ${planLabel}`,
          customer: {
            name: user.name || 'Freelancer',
            email: user.email,
          },
          notify: {
            sms: false,
            email: true,
          },
          reminder_enable: false,
          notes: {
            userId: user.id,
            orderDbId: paymentOrder.id,
            planTier: input.planTier,
          },
          callback_url: callbackUrl,
          callback_method: 'get',
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('Razorpay API payment_link error:', errBody);
        throw new Error(`Failed to create Razorpay payment link: ${response.statusText}`);
      }

      const rzpData = (await response.json()) as {
        id: string;
        short_url: string;
        order_id?: string;
      };

      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          razorpayOrderId: rzpData.order_id || rzpData.id,
          razorpayPaymentLink: rzpData.short_url,
        },
      });

      return {
        orderId: paymentOrder.id,
        razorpayOrderId: rzpData.order_id || rzpData.id,
        paymentUrl: rzpData.short_url,
        amountPaise,
        currency: 'INR',
        keyId,
        planTier: input.planTier,
      };
    } catch (err: any) {
      console.error('Razorpay payment link creation failed:', err);
    }
  }

  if (process.env.NODE_ENV === 'production' && (!keyId || !keySecret)) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) must be configured in production');
  }

  // Fallback / Mock Mode: returns a direct callback link for testing without live credentials
  const mockPaymentUrl = `${apiBase}/v1/subscriptions/payment-callback?orderDbId=${paymentOrder.id}&mock=true`;
  await prisma.paymentOrder.update({
    where: { id: paymentOrder.id },
    data: {
      razorpayOrderId: `mock_order_${paymentOrder.id}`,
      razorpayPaymentLink: mockPaymentUrl,
    },
  });

  return {
    orderId: paymentOrder.id,
    razorpayOrderId: `mock_order_${paymentOrder.id}`,
    paymentUrl: mockPaymentUrl,
    amountPaise,
    currency: 'INR',
    keyId: keyId || 'rzp_test_sandbox',
    planTier: input.planTier,
  };
}

/**
 * Compares two strings in constant time to prevent timing attacks.
 */
export function timingSafeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates Razorpay Payment Signature using HMAC-SHA256 in constant time.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret || !orderId || !paymentId || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return timingSafeCompare(expectedSignature, signature);
}

/**
 * Validates Razorpay Webhook Signature using HMAC-SHA256 against raw request body in constant time.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret?: string
): boolean {
  const secret = webhookSecret || getRazorpayWebhookSecret();
  if (!secret || !signature || !rawBody) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return timingSafeCompare(expectedSignature, signature);
}

/**
 * Fulfills a paid subscription order:
 * 1. Validates PaymentOrder status (idempotent).
 * 2. Updates PaymentOrder to SUCCESS.
 * 3. Grants Pro Tier to user (extending expiry if active).
 * 4. Logs audit and creates notification.
 */
export async function fulfillPayment(
  prisma: PrismaClient,
  input: {
    paymentOrderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }
): Promise<{ success: boolean; order: PaymentOrder; message: string }> {
  let order: PaymentOrder | null = null;

  if (input.paymentOrderId) {
    order = await prisma.paymentOrder.findUnique({
      where: { id: input.paymentOrderId },
    });
  } else if (input.razorpayOrderId) {
    order = await prisma.paymentOrder.findFirst({
      where: {
        OR: [
          { razorpayOrderId: input.razorpayOrderId },
          { id: input.razorpayOrderId },
        ],
      },
    });
  }

  if (!order) {
    throw new Error('Payment order record not found');
  }

  // Idempotency: If already fulfilled, return early
  if (order.status === 'SUCCESS') {
    return {
      success: true,
      order,
      message: 'Payment order was already processed and active.',
    };
  }

  // Update payment order to SUCCESS
  const updatedOrder = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'SUCCESS',
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature || order.razorpaySignature,
    },
  });

  // Calculate duration in days
  let durationDays: number | undefined;
  if (order.planTier === 'PRO_MONTHLY') {
    durationDays = 30;
  } else if (order.planTier === 'PRO_ANNUAL') {
    durationDays = 365;
  } else if (order.planTier === 'LIFETIME') {
    durationDays = undefined;
  }

  // Grant user plan
  await grantUserPlan(prisma, order.userId, order.planTier, durationDays);

  // Send push or in-app notification
  try {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'subscription_upgraded',
        payload: {
          planTier: order.planTier,
          amountPaise: order.amountPaise,
          paymentId: input.razorpayPaymentId,
        },
      },
    });
  } catch (err) {
    console.error('Failed to create subscription notification:', err);
  }

  return {
    success: true,
    order: updatedOrder,
    message: `Successfully activated ${order.planTier} subscription!`,
  };
}

/**
 * Retrieves payment transaction history for admin dashboard.
 */
export async function listPaymentOrders(
  prisma: PrismaClient,
  limit = 50
): Promise<{
  orders: any[];
  totalRevenuePaise: number;
  totalSuccessCount: number;
}> {
  const orders = await prisma.paymentOrder.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  const revenueAggregate = await prisma.paymentOrder.aggregate({
    where: { status: 'SUCCESS' },
    _sum: { amountPaise: true },
    _count: { id: true },
  });

  return {
    orders,
    totalRevenuePaise: revenueAggregate._sum.amountPaise ?? 0,
    totalSuccessCount: revenueAggregate._count.id ?? 0,
  };
}
