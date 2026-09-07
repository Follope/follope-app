import type { PrismaClient, PlanTier, Subscription } from '@prisma/client';
import { getPlanConfig } from './planConfigService.js';

export interface UserSubscriptionDetails {
  subscription: Subscription;
  isPro: boolean;
  tier: PlanTier;
  lifetimeInvoiceCount: number;
  freeInvoiceLimit: number;
  remainingInvoices: number;
  maxInvoiceEdits: number;
  expiresAt: Date | null;
  pricing?: {
    proMonthlyPaise: number;
    proAnnualPaise: number;
    lifetimePaise: number;
  };
}

/**
 * Gets or initializes a user's subscription record and verifies expiration.
 */
export async function getUserSubscription(
  prisma: PrismaClient,
  userId: string
): Promise<UserSubscriptionDetails> {
  if (!prisma?.subscription?.findUnique) {
    return {
      subscription: {
        id: 'mock_sub',
        userId,
        tier: 'PRO_MONTHLY',
        status: 'ACTIVE',
        customInvoiceLimit: null,
        startedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isPro: true,
      tier: 'PRO_MONTHLY',
      lifetimeInvoiceCount: 0,
      freeInvoiceLimit: 3,
      remainingInvoices: 999,
      maxInvoiceEdits: 999,
      expiresAt: null,
    };
  }

  const [config, sub, lifetimeInvoiceCount] = await Promise.all([
    getPlanConfig(prisma),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.invoice.count ? prisma.invoice.count({ where: { userId } }) : Promise.resolve(0),
  ]);

  let subscription = sub;

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        userId,
        tier: 'FREE',
        status: 'ACTIVE',
      },
    });
  }

  // Handle plan expiration
  if (
    subscription.tier !== 'FREE' &&
    subscription.tier !== 'LIFETIME' &&
    subscription.expiresAt &&
    subscription.expiresAt < new Date()
  ) {
    subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        tier: 'FREE',
        status: 'EXPIRED',
      },
    });
  }

  const isPro =
    (subscription.tier === 'PRO_MONTHLY' ||
      subscription.tier === 'PRO_ANNUAL' ||
      subscription.tier === 'LIFETIME') &&
    subscription.status === 'ACTIVE';

  const freeInvoiceLimit = subscription.customInvoiceLimit ?? config.freeInvoiceLimit;
  const remainingInvoices = isPro ? 999999 : Math.max(0, freeInvoiceLimit - lifetimeInvoiceCount);

  return {
    subscription,
    isPro,
    tier: subscription.tier,
    lifetimeInvoiceCount,
    freeInvoiceLimit,
    remainingInvoices,
    maxInvoiceEdits: isPro ? 999999 : (config.freeMaxInvoiceEdits ?? (config as any).maxInvoiceEdits ?? 1),
    expiresAt: subscription.expiresAt,
    pricing: {
      proMonthlyPaise: config.proMonthlyPricePaise ?? 29900,
      proAnnualPaise: config.proAnnualPricePaise ?? 249900,
      lifetimePaise: (config as any).lifetimePricePaise ?? 499900,
    },
  };
}

/**
 * Verifies if user can create a new invoice under their active tier.
 */
export async function canCreateInvoice(
  prisma: PrismaClient,
  userId: string
): Promise<{ allowed: boolean; reason?: string; isPro: boolean; remaining: number }> {
  const details = await getUserSubscription(prisma, userId);

  if (details.isPro) {
    return { allowed: true, isPro: true, remaining: 999999 };
  }

  if (details.lifetimeInvoiceCount >= details.freeInvoiceLimit) {
    return {
      allowed: false,
      reason: `You have reached your Free plan limit of ${details.freeInvoiceLimit} invoices. Upgrade to Pro or redeem a promo code for unlimited invoices.`,
      isPro: false,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    isPro: false,
    remaining: details.remainingInvoices,
  };
}

/**
 * Verifies if user can edit an invoice under their active tier.
 */
export async function canEditInvoice(
  prisma: PrismaClient,
  userId: string,
  invoiceId: string
): Promise<{ allowed: boolean; reason?: string; isPro: boolean; currentEdits: number; maxEdits: number }> {
  const details = await getUserSubscription(prisma, userId);

  if (details.isPro) {
    return { allowed: true, isPro: true, currentEdits: 0, maxEdits: 999999 };
  }

  const editCount = prisma?.invoiceRevision?.count
    ? await prisma.invoiceRevision.count({ where: { invoiceId } })
    : 0;

  if (editCount >= details.maxInvoiceEdits) {
    return {
      allowed: false,
      reason: `Free plan allows only ${details.maxInvoiceEdits} edit per invoice. Upgrade to Pro for unlimited edits and revisions.`,
      isPro: false,
      currentEdits: editCount,
      maxEdits: details.maxInvoiceEdits,
    };
  }

  return {
    allowed: true,
    isPro: false,
    currentEdits: editCount,
    maxEdits: details.maxInvoiceEdits,
  };
}

/**
 * Grants or extends a user's subscription tier.
 */
export async function grantUserPlan(
  prisma: PrismaClient,
  userId: string,
  tier: PlanTier,
  durationDays?: number
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });

  let expiresAt: Date | null = null;

  if (tier === 'LIFETIME' || tier === 'FREE') {
    expiresAt = null;
  } else if (durationDays) {
    // If user currently has active Pro with a future expiry date, extend from that date
    const baseDate =
      existing?.expiresAt && existing.expiresAt > new Date()
        ? new Date(existing.expiresAt)
        : new Date();
    baseDate.setDate(baseDate.getDate() + durationDays);
    expiresAt = baseDate;
  }

  return prisma.subscription.upsert({
    where: { userId },
    update: {
      tier,
      status: 'ACTIVE',
      expiresAt,
    },
    create: {
      userId,
      tier,
      status: 'ACTIVE',
      expiresAt,
    },
  });
}