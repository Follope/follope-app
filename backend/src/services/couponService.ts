import type { PrismaClient, Coupon } from '@prisma/client';
import { grantUserPlan } from './subscriptionService.js';
import { ApiError } from '../utils/errors.js';

export interface CreateCouponInput {
  code: string;
  discountType?: string; // "FREE_PRO_MONTHS" | "PERCENTAGE"
  discountValue?: number;
  maxUses?: number | null;
  expiresAt?: Date | null;
}

export async function createCoupon(
  prisma: PrismaClient,
  input: CreateCouponInput
): Promise<Coupon> {
  const code = input.code.trim().toUpperCase();

  const existing = await prisma.coupon.findUnique({
    where: { code },
  });
  if (existing) {
    throw new ApiError(409, 'COUPON_EXISTS', `Coupon code "${code}" already exists.`);
  }

  return prisma.coupon.create({
    data: {
      code,
      discountType: input.discountType ?? 'FREE_PRO_MONTHS',
      discountValue: input.discountValue ?? 1,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: true,
    },
  });
}

export async function redeemCoupon(
  prisma: PrismaClient,
  userId: string,
  rawCode: string
): Promise<{ coupon: Coupon; message: string }> {
  const code = rawCode.trim().toUpperCase();

  const coupon = await prisma.coupon.findUnique({
    where: { code },
  });

  if (!coupon || !coupon.isActive) {
    throw new ApiError(404, 'INVALID_COUPON', 'Invalid or expired coupon code.');
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new ApiError(400, 'COUPON_EXPIRED', 'This coupon code has expired.');
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new ApiError(400, 'COUPON_EXHAUSTED', 'This coupon has reached its maximum redemptions.');
  }

  const existingRedemption = await prisma.couponRedemption.findUnique({
    where: {
      couponId_userId: {
        couponId: coupon.id,
        userId,
      },
    },
  });

  if (existingRedemption) {
    throw new ApiError(400, 'ALREADY_REDEEMED', 'You have already redeemed this coupon.');
  }

  // Transactionally record redemption and grant plan
  let daysGranted = 30;
  if (coupon.discountType === 'FREE_PRO_MONTHS') {
    daysGranted = Math.max(1, coupon.discountValue) * 30;
  } else if (coupon.discountType === 'PERCENTAGE' && coupon.discountValue === 100) {
    daysGranted = 30;
  }

  await prisma.$transaction([
    prisma.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId,
      },
    }),
    prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: { increment: 1 },
      },
    }),
  ]);

  await grantUserPlan(prisma, userId, 'PRO_MONTHLY', daysGranted);

  return {
    coupon,
    message: `Coupon applied successfully! You received ${Math.round(daysGranted / 30)} month(s) of Pro for free.`,
  };
}

export async function listCoupons(prisma: PrismaClient): Promise<Coupon[]> {
  return prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { redemptions: true },
      },
    },
  });
}

export async function toggleCouponStatus(
  prisma: PrismaClient,
  couponId: string,
  isActive?: boolean
): Promise<Coupon> {
  if (typeof isActive === 'boolean') {
    return prisma.coupon.update({
      where: { id: couponId },
      data: { isActive },
    });
  }
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) {
    throw new ApiError(404, 'NOT_FOUND', 'Coupon not found');
  }
  return prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: !coupon.isActive },
  });
}