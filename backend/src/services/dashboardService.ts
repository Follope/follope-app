import type { PrismaClient } from '@prisma/client';

export function createDashboardService(prisma: PrismaClient) {
  return {
    async get(userId: string) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [outstandingAgg, thisMonthAgg, invoiceCount, recentInvoices] = await Promise.all([
        // Outstanding = sum of balance across all non-cancelled invoices
        prisma.invoice.aggregate({
          where: { userId, status: { notIn: ['CANCELLED', 'DRAFT'] } },
          _sum: { balancePaise: true },
        }),
        // This month = sum of payments actually received this calendar month
        // (not invoice totals — matches what a freelancer means by "money in this month")
        prisma.payment.aggregate({
          where: {
            invoice: { userId },
            paidAt: { gte: monthStart },
          },
          _sum: { amountPaise: true },
        }),
        prisma.invoice.count({ where: { userId, status: { not: 'CANCELLED' } } }),
        prisma.invoice.findMany({
          where: { userId },
          include: { client: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      return {
        outstandingPaise: outstandingAgg._sum.balancePaise ?? 0,
        thisMonthPaise: thisMonthAgg._sum.amountPaise ?? 0,
        invoiceCount,
        recentInvoices,
      };
    },

    async analytics(userId: string, months = 6) {
      const safeMonths = Math.max(1, Math.min(months, 12));
      const now = new Date();
      const firstMonth = new Date(now.getFullYear(), now.getMonth() - safeMonths + 1, 1);
      const [payments, invoices, overdue] = await Promise.all([
        prisma.payment.findMany({ where: { invoice: { userId }, paidAt: { gte: firstMonth } }, select: { amountPaise: true, paidAt: true } }),
        prisma.invoice.findMany({ where: { userId, createdAt: { gte: firstMonth }, status: { not: 'CANCELLED' } }, select: { totalPaise: true, createdAt: true } }),
        prisma.invoice.aggregate({
          where: { userId, dueDate: { lt: now }, balancePaise: { gt: 0 }, status: { notIn: ['DRAFT', 'CANCELLED', 'PAID'] } },
          _sum: { balancePaise: true },
          _count: true,
        }),
      ]);
      const buckets = Array.from({ length: safeMonths }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - safeMonths + 1 + index, 1);
        return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en-IN', { month: 'short' }), receivedPaise: 0, invoicedPaise: 0 };
      });
      const bucketFor = (date: Date) => buckets.find((bucket) => bucket.key === `${date.getFullYear()}-${date.getMonth()}`);
      payments.forEach((payment) => { const bucket = bucketFor(payment.paidAt); if (bucket) bucket.receivedPaise += payment.amountPaise; });
      invoices.forEach((invoice) => { const bucket = bucketFor(invoice.createdAt); if (bucket) bucket.invoicedPaise += invoice.totalPaise; });
      return {
        months: buckets.map(({ key: _key, ...bucket }) => bucket),
        overdue: { count: overdue._count, amountPaise: overdue._sum.balancePaise ?? 0 },
      };
    },
  };
}
