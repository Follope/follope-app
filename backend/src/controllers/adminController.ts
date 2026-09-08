import type { Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AdminRequest } from '../middleware/requireAdmin.js';
import { getPlanConfig, updatePlanConfig, type UpdatePlanConfigInput } from '../services/planConfigService.js';
import { grantUserPlan } from '../services/subscriptionService.js';
import { createCoupon, listCoupons, toggleCouponStatus } from '../services/couponService.js';
import { listPaymentOrders } from '../services/razorpayService.js';
import { ApiError } from '../utils/errors.js';

export function createAdminController(prisma: PrismaClient) {
  return {
    async login(req: AdminRequest, res: Response) {
      const { secret } = req.body ?? {};
      const masterSecret = process.env.ADMIN_SECRET || 'follope_superadmin_2026';

      if (!secret || secret !== masterSecret) {
        return res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid admin master secret key.' },
        });
      }

      return res.json({
        data: {
          token: masterSecret,
          role: 'ADMIN',
          message: 'Admin authorization successful.',
        },
      });
    },

    async getMetrics(_req: AdminRequest, res: Response) {
      const [
        totalUsers,
        bannedUsers,
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        invoiceTotals,
        subscriptionCounts,
        totalCoupons,
        totalReferrals,
        rewardedReferrals,
        paymentAggregate,
        recentUsers,
        recentInvoices,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isBanned: true } }),
        prisma.invoice.count(),
        prisma.invoice.count({ where: { status: 'PAID' } }),
        prisma.invoice.count({ where: { status: 'OVERDUE' } }),
        prisma.invoice.aggregate({
          _sum: {
            totalPaise: true,
            balancePaise: true,
          },
        }),
        prisma.subscription.groupBy({
          by: ['tier'],
          _count: { tier: true },
        }),
        prisma.coupon.count(),
        prisma.referral.count(),
        prisma.referral.count({ where: { rewardGranted: true } }),
        prisma.paymentOrder.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amountPaise: true },
          _count: { id: true },
        }),
        prisma.user.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            isBanned: true,
            subscription: {
              select: { tier: true, status: true, expiresAt: true },
            },
            _count: {
              select: { invoices: true },
            },
          },
        }),
        prisma.invoice.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalPaise: true,
            status: true,
            createdAt: true,
            user: {
              select: { name: true, email: true },
            },
            client: {
              select: { name: true },
            },
          },
        }),
      ]);

      const billedPaise = invoiceTotals._sum.totalPaise ?? 0;
      const outstandingPaise = invoiceTotals._sum.balancePaise ?? 0;
      const collectedPaise = Math.max(0, billedPaise - outstandingPaise);

      const tierMap: Record<string, number> = {
        FREE: 0,
        PRO_MONTHLY: 0,
        PRO_ANNUAL: 0,
        LIFETIME: 0,
      };
      subscriptionCounts.forEach((c) => {
        tierMap[c.tier] = c._count.tier;
      });

      const proUsersCount = (tierMap.PRO_MONTHLY || 0) + (tierMap.PRO_ANNUAL || 0) + (tierMap.LIFETIME || 0);

      return res.json({
        data: {
          users: {
            total: totalUsers,
            pro: proUsersCount,
            free: totalUsers - proUsersCount,
            banned: bannedUsers,
            tierBreakdown: tierMap,
          },
          invoices: {
            total: totalInvoices,
            paid: paidInvoices,
            overdue: overdueInvoices,
            totalBilledPaise: billedPaise,
            totalCollectedPaise: collectedPaise,
            outstandingPaise,
          },
          coupons: {
            total: totalCoupons,
          },
          referrals: {
            total: totalReferrals,
            rewarded: rewardedReferrals,
          },
          revenue: {
            totalPaise: paymentAggregate._sum.amountPaise ?? 0,
            totalOrders: paymentAggregate._count.id ?? 0,
          },
          recentUsers,
          recentInvoices,
        },
      });
    },

    async listPayments(_req: AdminRequest, res: Response) {
      const data = await listPaymentOrders(prisma, 100);
      return res.json({ data });
    },

    async getConfig(_req: AdminRequest, res: Response) {
      const config = await getPlanConfig(prisma);
      return res.json({ data: config });
    },

    async updateConfig(req: AdminRequest, res: Response) {
      try {
        const input: UpdatePlanConfigInput = req.body ?? {};
        const updated = await updatePlanConfig(prisma, input);
        return res.json({ data: updated });
      } catch (err) {
        console.error('[Admin] Failed to update plan config:', err);
        return res.status(400).json({ error: { code: 'CONFIG_ERROR', message: 'Failed to update plan configuration' } });
      }
    },

    async listUsers(req: AdminRequest, res: Response) {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
      const search = (typeof req.query.search === 'string' ? req.query.search.trim() : '') || undefined;
      const tierFilter = typeof req.query.tier === 'string' ? req.query.tier.trim().toUpperCase() : undefined;

      const whereClause: any = {};
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { referralCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (tierFilter && ['FREE', 'PRO_MONTHLY', 'PRO_ANNUAL', 'LIFETIME'].includes(tierFilter)) {
        whereClause.subscription = { tier: tierFilter };
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            referralCode: true,
            isBanned: true,
            createdAt: true,
            subscription: {
              select: {
                tier: true,
                status: true,
                expiresAt: true,
              },
            },
            _count: {
              select: {
                invoices: true,
                clients: true,
              },
            },
          },
        }),
      ]);

      return res.json({
        data: {
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    },

    async updateUserPlan(req: AdminRequest, res: Response) {
      const id = String(req.params.id);
      const { tier, days, months } = req.body ?? {};

      if (!tier || !['FREE', 'PRO_MONTHLY', 'PRO_ANNUAL', 'LIFETIME'].includes(tier)) {
        return res.status(400).json({ error: { code: 'INVALID_TIER', message: 'Valid tier is required.' } });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      const durationDays = days || (months ? months * 30 : tier === 'PRO_ANNUAL' ? 365 : 30);
      const updatedSub = await grantUserPlan(prisma, id, tier, durationDays);

      return res.json({
        data: {
          success: true,
          subscription: updatedSub,
        },
      });
    },

    async toggleUserBan(req: AdminRequest, res: Response) {
      const id = String(req.params.id);
      const { isBanned } = req.body ?? {};

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isBanned: Boolean(isBanned) },
        select: { id: true, email: true, name: true, isBanned: true },
      });

      return res.json({ data: updated });
    },

    async listCoupons(_req: AdminRequest, res: Response) {
      const coupons = await listCoupons(prisma);
      return res.json({ data: coupons });
    },

    async createCoupon(req: AdminRequest, res: Response) {
      try {
        const { code, discountType, discountValue, maxUses, expiresAt } = req.body ?? {};
        if (!code || typeof code !== 'string') {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Coupon code is required' } });
        }

        const coupon = await createCoupon(prisma, {
          code,
          discountType: discountType || 'FREE_PRO_MONTHS',
          discountValue: Number(discountValue) || 1,
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        });

        return res.status(201).json({ data: coupon });
      } catch (err: any) {
        if (err instanceof ApiError) {
          return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        }
        return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to create coupon' } });
      }
    },

    async toggleCoupon(req: AdminRequest, res: Response) {
      const id = String(req.params.id);
      try {
        const updated = await toggleCouponStatus(prisma, id);
        return res.json({ data: updated });
      } catch (err: any) {
        if (err instanceof ApiError) {
          return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        }
        return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to toggle coupon' } });
      }
    },

    async deleteCoupon(req: AdminRequest, res: Response) {
      const id = String(req.params.id);
      try {
        await prisma.coupon.delete({ where: { id } });
        return res.json({ data: { success: true } });
      } catch {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
      }
    },

    async listReferrals(_req: AdminRequest, res: Response) {
      const referrals = await prisma.referral.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: { select: { id: true, name: true, email: true, referralCode: true } },
          referee: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              _count: { select: { invoices: true } },
            },
          },
        },
      });

      return res.json({ data: referrals });
    },

    async exportUsersCsv(_req: AdminRequest, res: Response) {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: { select: { invoices: true, clients: true } },
        },
      });

      const headers = [
        'User ID',
        'Name',
        'Email',
        'Role',
        'Plan Tier',
        'Status',
        'Expires At',
        'Invoices Created',
        'Clients Count',
        'Referral Code',
        'Is Banned',
        'Joined Date',
      ];

      const rows = users.map((u) => [
        u.id,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        u.role,
        u.subscription?.tier || 'FREE',
        u.subscription?.status || 'ACTIVE',
        u.subscription?.expiresAt ? u.subscription.expiresAt.toISOString().split('T')[0] : 'Never',
        u._count.invoices,
        u._count.clients,
        u.referralCode || '',
        u.isBanned ? 'YES' : 'NO',
        u.createdAt.toISOString().split('T')[0],
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="follope_users_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    },

    async exportInvoicesCsv(_req: AdminRequest, res: Response) {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          client: { select: { name: true } },
        },
      });

      const headers = [
        'Invoice ID',
        'Invoice Number',
        'User Name',
        'User Email',
        'Client Name',
        'Status',
        'Total (INR)',
        'Balance Due (INR)',
        'Issue Date',
        'Due Date',
        'Created At',
      ];

      const rows = invoices.map((inv) => [
        inv.id,
        `"${inv.invoiceNumber}"`,
        `"${(inv.user.name || '').replace(/"/g, '""')}"`,
        `"${(inv.user.email || '').replace(/"/g, '""')}"`,
        `"${(inv.client.name || '').replace(/"/g, '""')}"`,
        inv.status,
        (inv.totalPaise / 100).toFixed(2),
        (inv.balancePaise / 100).toFixed(2),
        inv.issueDate ? inv.issueDate.toISOString().split('T')[0] : '',
        inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '',
        inv.createdAt.toISOString().split('T')[0],
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="follope_invoices_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    },
  };
}
