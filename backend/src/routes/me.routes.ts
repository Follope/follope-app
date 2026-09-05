import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createBusinessService, createProfileService } from '../services/businessService.js';
import { createAuthService, AuthError } from '../services/authService.js';
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

  return router;
}
