import { describe, it, expect, vi } from 'vitest';
import { canCreateInvoice, canEditInvoice, grantUserPlan } from '../subscriptionService.js';
import { createCoupon, redeemCoupon } from '../couponService.js';
import { checkAndRewardReferralOnFirstInvoice } from '../referralService.js';
import { ApiError } from '../../utils/errors.js';

describe('Subscription, Quotas & Referral Security Tests', () => {
  const mockConfig = {
    id: 'default',
    freeInvoiceLimit: 3,
    maxInvoiceEdits: 1,
    referralRewardMonths: 1,
    proMonthlyPricePaise: 29900,
    proAnnualPricePaise: 249900,
    lifetimePricePaise: 499900,
    bannerNotice: null,
    bannerNoticeActive: false,
    updatedAt: new Date(),
  };

  it('enforces strict lifetime 3-invoice limit for Free tier accounts', async () => {
    // When user has 2 invoices
    const mockPrismaUnderLimit = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      subscription: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'sub_1',
            userId: 'user_1',
            tier: 'FREE',
            status: 'ACTIVE',
            expiresAt: null,
          })
        ),
      },
      invoice: { count: vi.fn(() => Promise.resolve(2)) },
    } as any;

    const check1 = await canCreateInvoice(mockPrismaUnderLimit, 'user_1');
    expect(check1.allowed).toBe(true);
    expect(check1.remaining).toBe(1);

    // When user already created 3 invoices
    const mockPrismaAtLimit = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      subscription: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'sub_1',
            userId: 'user_1',
            tier: 'FREE',
            status: 'ACTIVE',
            expiresAt: null,
          })
        ),
      },
      invoice: { count: vi.fn(() => Promise.resolve(3)) },
    } as any;

    const check2 = await canCreateInvoice(mockPrismaAtLimit, 'user_1');
    expect(check2.allowed).toBe(false);
    expect(check2.remaining).toBe(0);
    expect(check2.reason).toContain('limit of 3 invoices');
  });

  it('allows unlimited invoice creation for active Pro tier accounts', async () => {
    const mockPrismaPro = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      subscription: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'sub_pro',
            userId: 'user_pro',
            tier: 'PRO_MONTHLY',
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 86400000 * 30),
          })
        ),
      },
      invoice: { count: vi.fn(() => Promise.resolve(99)) },
    } as any;

    const check = await canCreateInvoice(mockPrismaPro, 'user_pro');
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBeGreaterThan(1000);
  });

  it('enforces strictly 1 edit revision per invoice on Free tier and blocks second edit', async () => {
    let revisionsCount = 0;
    const mockPrismaFree = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      subscription: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'sub_free',
            userId: 'user_free',
            tier: 'FREE',
            status: 'ACTIVE',
            expiresAt: null,
          })
        ),
      },
      invoice: { count: vi.fn(() => Promise.resolve(1)) },
      invoiceRevision: {
        count: vi.fn(() => Promise.resolve(revisionsCount)),
      },
    } as any;

    // Revision count = 0 (first edit allowed)
    const check1 = await canEditInvoice(mockPrismaFree, 'user_free', 'inv_1');
    expect(check1.allowed).toBe(true);

    // Revision count = 1 (already edited once, second edit blocked!)
    revisionsCount = 1;
    const check2 = await canEditInvoice(mockPrismaFree, 'user_free', 'inv_1');
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toContain('Free plan allows only 1 edit per invoice');
  });

  it('allows unlimited revisions for Pro subscribers', async () => {
    const mockPrismaPro = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      subscription: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'sub_pro',
            userId: 'user_pro',
            tier: 'LIFETIME',
            status: 'ACTIVE',
            expiresAt: null,
          })
        ),
      },
      invoice: { count: vi.fn(() => Promise.resolve(5)) },
      invoiceRevision: { count: vi.fn(() => Promise.resolve(50)) },
    } as any;

    const check = await canEditInvoice(mockPrismaPro, 'user_pro', 'inv_1');
    expect(check.allowed).toBe(true);
  });

  it('handles coupon redemption and prevents duplicate redemption by same user', async () => {
    const mockCoupon = {
      id: 'cpn_1',
      code: 'WELCOMEPRO',
      discountType: 'FREE_PRO_MONTHS',
      discountValue: 1,
      usedCount: 0,
      maxUses: 10,
      isActive: true,
      expiresAt: null,
    };

    const mockPrismaCoupon = {
      coupon: {
        findUnique: vi.fn(({ where }: any) => {
          if (where.code === 'WELCOMEPRO') return Promise.resolve(mockCoupon);
          return Promise.resolve(null);
        }),
        update: vi.fn(() => Promise.resolve(mockCoupon)),
      },
      couponRedemption: {
        findUnique: vi.fn(({ where }: any) => {
          // If checking user_duplicate, return existing redemption
          if (where.couponId_userId.userId === 'user_duplicate') {
            return Promise.resolve({ id: 'red_1', couponId: 'cpn_1', userId: 'user_duplicate' });
          }
          return Promise.resolve(null);
        }),
        create: vi.fn(() => Promise.resolve({ id: 'red_new' })),
      },
      subscription: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        upsert: vi.fn(() => Promise.resolve({ tier: 'PRO_MONTHLY', status: 'ACTIVE' })),
      },
      $transaction: vi.fn((ops: any) => Promise.all(ops)),
    } as any;

    // First user succeeds
    const result = await redeemCoupon(mockPrismaCoupon, 'user_new', 'WELCOMEPRO');
    expect(result.coupon.code).toBe('WELCOMEPRO');
    expect(result.message).toContain('Coupon applied successfully');

    // Duplicate redemption is rejected
    await expect(
      redeemCoupon(mockPrismaCoupon, 'user_duplicate', 'WELCOMEPRO')
    ).rejects.toThrow(ApiError);
  });

  it('rewards both referrer and referee only when referee creates their first invoice', async () => {
    let referrerProGranted = false;
    let refereeProGranted = false;

    const mockPrismaReferral = {
      planConfig: { findUnique: vi.fn(() => Promise.resolve(mockConfig)) },
      invoice: {
        // Exactly 1 invoice triggers the milestone
        count: vi.fn(() => Promise.resolve(1)),
      },
      referral: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'ref_1',
            referrerId: 'user_referrer',
            refereeId: 'user_referee',
            rewardGranted: false,
            referee: { name: 'New Friend' },
            referrer: { id: 'user_referrer', name: 'Original User' },
          })
        ),
        update: vi.fn(() => Promise.resolve({})),
      },
      subscription: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        upsert: vi.fn(({ where }: any) => {
          if (where.userId === 'user_referrer') referrerProGranted = true;
          if (where.userId === 'user_referee') refereeProGranted = true;
          return Promise.resolve({ tier: 'PRO_MONTHLY', status: 'ACTIVE' });
        }),
      },
      notification: {
        create: vi.fn(() => Promise.resolve({})),
      },
    } as any;

    const triggered = await checkAndRewardReferralOnFirstInvoice(mockPrismaReferral, 'user_referee');
    expect(triggered).toBe(true);
    expect(referrerProGranted).toBe(true);
    expect(refereeProGranted).toBe(true);
  });
});
