import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { grantUserPlan } from './subscriptionService.js';
import { getPlanConfig } from './planConfigService.js';

/**
 * Generates a clean, unique alphanumeric referral code.
 * Format: FOL-XXXXXX (e.g. FOL-A8B2C4)
 */
export function generateReferralCode(): string {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FOL-${rand}`;
}

/**
 * Links a newly registered user to a referrer code.
 */
export async function attachReferralOnSignup(
  prisma: PrismaClient,
  refereeId: string,
  rawCode?: string | null
): Promise<void> {
  if (!rawCode) return;
  const code = rawCode.trim().toUpperCase();

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });

  if (!referrer || referrer.id === refereeId) return;

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: refereeId },
        data: { referredById: referrer.id },
      }),
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId,
          codeUsed: code,
          rewardGranted: false,
        },
      }),
    ]);
  } catch (err) {
    console.error('[Referral] Failed to attach referral on signup:', err);
  }
}

/**
 * Anti-Fraud Referral Reward Trigger:
 * Called immediately after a user creates an invoice.
 * If this is the user's first invoice and they were referred, grants 1 month
 * of Pro to BOTH the referrer and referee, and dispatches a celebratory notification.
 */
export async function checkAndRewardReferralOnFirstInvoice(
  prisma: PrismaClient,
  refereeId: string
): Promise<boolean> {
  // Count how many invoices this user has
  const invoiceCount = await prisma.invoice.count({
    where: { userId: refereeId },
  });

  // Only trigger on first invoice
  if (invoiceCount !== 1) return false;

  const referral = await prisma.referral.findUnique({
    where: { refereeId },
    include: {
      referee: { select: { name: true } },
      referrer: { select: { id: true, name: true } },
    },
  });

  if (!referral || referral.rewardGranted) return false;

  const config = await getPlanConfig(prisma);
  const rewardDays = Math.max(1, config.referralRewardMonths) * 30;

  // Mark referral rewarded
  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      rewardGranted: true,
      rewardedAt: new Date(),
    },
  });

  // Grant Pro to both users
  await Promise.all([
    grantUserPlan(prisma, referral.referrerId, 'PRO_MONTHLY', rewardDays),
    grantUserPlan(prisma, refereeId, 'PRO_MONTHLY', rewardDays),
  ]);

  // Create notification for referrer
  await prisma.notification.create({
    data: {
      userId: referral.referrerId,
      type: 'referral_reward',
      payload: {
        title: '🎉 You earned free Pro!',
        body: `${referral.referee.name} created their first invoice. You both received ${config.referralRewardMonths} month(s) of free Pro!`,
      },
    },
  });

  return true;
}

/**
 * Retrieves referral statistics and history for a given user.
 */
export async function getReferralStats(prisma: PrismaClient, userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  // Self-heal if existing user didn't have a referral code
  if (!user?.referralCode) {
    const code = generateReferralCode();
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
    user = { referralCode: code };
  }

  const [totalReferred, rewardedCount, referrals] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referral.count({ where: { referrerId: userId, rewardGranted: true } }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referee: {
          select: { name: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const config = await getPlanConfig(prisma);

  return {
    referralCode: user.referralCode,
    shareUrl: `https://follope.com/join?ref=${user.referralCode}`,
    rewardMonthsPerReferral: config.referralRewardMonths,
    totalReferred,
    rewardedCount,
    referrals: referrals.map((r) => ({
      friendName: r.referee.name,
      joinedAt: r.createdAt,
      rewardGranted: r.rewardGranted,
      rewardedAt: r.rewardedAt,
    })),
  };
}

/**
 * Lists all referrals across the platform for the admin panel.
 */
export async function listAllReferrals(prisma: PrismaClient) {
  return prisma.referral.findMany({
    include: {
      referrer: { select: { id: true, name: true, email: true } },
      referee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}