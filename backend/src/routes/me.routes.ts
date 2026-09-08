import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createBusinessService, createProfileService } from '../services/businessService.js';
import { createAuthService, AuthError } from '../services/authService.js';
import { getUserSubscription } from '../services/subscriptionService.js';
import { getReferralStats } from '../services/referralService.js';
import { redeemCoupon } from '../services/couponService.js';
import { ApiError } from '../utils/errors.js';
import { businessSchema, profileSchema } from '../lib/settingsValidation.js';
import { changePasswordSchema } from '../lib/validation.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

export function createMeRouter(prisma: PrismaClient) {
  const router = Router();
  const businessService = createBusinessService(prisma);
  const profileService = createProfileService(prisma);
  const authService = createAuthService(prisma);

  router.use(requireAuth);

  router.get('/', async (req: AuthedRequest, res) => {
    const [user, profile, business] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId! }, select: { id: true, name: true, email: true } }),
      profileService.get(req.userId!),
      businessService.get(req.userId!),
    ]);
    return res.json({ data: { user, profile, business } });
  });

  router.get('/business', async (req: AuthedRequest, res) => {
    const business = await businessService.get(req.userId!);
    return res.json({ data: business });
  });

  router.patch('/business', async (req: AuthedRequest, res) => {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      const business = await businessService.upsert(req.userId!, parsed.data);
      return res.json({ data: business });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid input';
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
    }
  });

  router.get('/profile', async (req: AuthedRequest, res) => {
    const profile = await profileService.get(req.userId!);
    return res.json({ data: profile });
  });

  router.patch('/profile', async (req: AuthedRequest, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    const profile = await profileService.upsert(req.userId!, parsed.data);
    return res.json({ data: profile });
  });

  router.post('/onboarding/complete', async (req: AuthedRequest, res) => {
    const profile = await profileService.markOnboarded(req.userId!);
    return res.json({ data: profile });
  });

  router.post('/change-password', async (req: AuthedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      await authService.changePassword(req.userId!, parsed.data.currentPassword, parsed.data.newPassword);
      return res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error(err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.get('/sessions', async (req: AuthedRequest, res) => {
    const sessions = await authService.listActiveSessions(req.userId!);
    return res.json({ data: sessions });
  });

  router.delete('/sessions/:id', async (req: AuthedRequest, res) => {
    const revoked = await authService.revokeSession(req.userId!, String(req.params.id));
    if (!revoked) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    return res.json({ data: { success: true } });
  });

  router.get('/subscription', async (req: AuthedRequest, res) => {
    try {
      const sub = await getUserSubscription(prisma, req.userId!);
      return res.json({ data: sub });
    } catch (err) {
      console.error('[Subscription] Failed to get user subscription:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to fetch subscription' } });
    }
  });

  router.get('/referral', async (req: AuthedRequest, res) => {
    try {
      const stats = await getReferralStats(prisma, req.userId!);
      return res.json({ data: stats });
    } catch (err) {
      console.error('[Referral] Failed to get referral stats:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to fetch referral stats' } });
    }
  });

  router.post('/redeem-coupon', async (req: AuthedRequest, res) => {
    const { code } = req.body ?? {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Coupon code is required.' },
      });
    }

    try {
      const result = await redeemCoupon(prisma, req.userId!, code);
      return res.json({ data: result });
    } catch (err: any) {
      if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
          error: { code: err.code, message: err.message },
        });
      }
      console.error('[Coupon] Redemption error:', err);
      return res.status(500).json({
        error: { code: 'INTERNAL', message: 'Failed to redeem coupon.' },
      });
    }
  });

  // DELETE /v1/me/account — Google Play mandatory user account & data deletion
  router.delete('/account', async (req: AuthedRequest, res) => {
    try {
      await prisma.user.delete({
        where: { id: req.userId! },
      });
      return res.json({
        data: { success: true, message: 'Account and all associated invoice data have been permanently deleted.' },
      });
    } catch (err) {
      console.error('[me.routes] Failed to delete account:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to delete account' } });
    }
  });

  return router;
}
