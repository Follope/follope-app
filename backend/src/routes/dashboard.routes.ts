import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createDashboardService } from '../services/dashboardService.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

export function createDashboardRouter(prisma: PrismaClient) {
  const router = Router();
  const dashboardService = createDashboardService(prisma);

  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    const data = await dashboardService.get(req.userId!);
    return res.json({ data });
  });

  router.get('/analytics', requireAuth, async (req: AuthedRequest, res) => {
    const requestedMonths = Number(req.query.months ?? 6);
    const data = await dashboardService.analytics(req.userId!, Number.isFinite(requestedMonths) ? requestedMonths : 6);
    return res.json({ data });
  });

  return router;
}
