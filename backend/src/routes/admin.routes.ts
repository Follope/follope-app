import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createAdminController } from '../controllers/adminController.js';
import { createRequireAdmin } from '../middleware/requireAdmin.js';
import { getAdminHtml } from '../views/adminHtml.js';
import { rateLimit } from '../middleware/rateLimit.js';

export function createAdminRouter(prisma: PrismaClient) {
  const router = Router();
  const adminController = createAdminController(prisma);
  const requireAdmin = createRequireAdmin(prisma);

  // 1. Serve Admin Web Panel UI at /admin
  router.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Restrict external resources to the exact providers used by this page.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
    return res.send(getAdminHtml());
  });

  return router;
}

export function createAdminApiRouter(prisma: PrismaClient) {
  const router = Router();
  const adminController = createAdminController(prisma);
  const requireAdmin = createRequireAdmin(prisma);

  // Public admin auth verification
  router.post('/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), adminController.login);

  // Protected Admin endpoints
  router.use(requireAdmin);

  router.get('/metrics', adminController.getMetrics);
  router.get('/config', adminController.getConfig);
  router.put('/config', adminController.updateConfig);

  router.get('/users', adminController.listUsers);
  router.post('/users/:id/plan', adminController.updateUserPlan);
  router.post('/users/:id/ban', adminController.toggleUserBan);

  router.get('/coupons', adminController.listCoupons);
  router.post('/coupons', adminController.createCoupon);
  router.patch('/coupons/:id/toggle', adminController.toggleCoupon);
  router.delete('/coupons/:id', adminController.deleteCoupon);

  router.get('/referrals', adminController.listReferrals);
  router.get('/payments', adminController.listPayments);

  router.get('/export/users.csv', adminController.exportUsersCsv);
  router.get('/export/invoices.csv', adminController.exportInvoicesCsv);

  return router;
}
