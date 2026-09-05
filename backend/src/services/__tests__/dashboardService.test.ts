import { describe, it, expect, vi } from 'vitest';
import { createDashboardService } from '../dashboardService.js';

function mockPrisma(overrides: {
  outstandingSum?: number | null;
  thisMonthSum?: number | null;
  invoiceCount?: number;
  recentInvoices?: unknown[];
}) {
  return {
    invoice: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { balancePaise: overrides.outstandingSum ?? null } }),
      count: vi.fn().mockResolvedValue(overrides.invoiceCount ?? 0),
      findMany: vi.fn().mockResolvedValue(overrides.recentInvoices ?? []),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaise: overrides.thisMonthSum ?? null } }),
    },
  } as any;
}

describe('dashboardService.get', () => {
  it('returns zeroed values when the user has no invoices yet', async () => {
    const prisma = mockPrisma({});
    const service = createDashboardService(prisma);
    const result = await service.get('user_1');

    expect(result).toEqual({
      outstandingPaise: 0,
      thisMonthPaise: 0,
      invoiceCount: 0,
      recentInvoices: [],
    });
  });

  it('surfaces aggregated sums when present', async () => {
    const prisma = mockPrisma({ outstandingSum: 38000_00, thisMonthSum: 72500_00, invoiceCount: 24 });
    const service = createDashboardService(prisma);
    const result = await service.get('user_1');

    expect(result.outstandingPaise).toBe(3800000);
    expect(result.thisMonthPaise).toBe(7250000);
    expect(result.invoiceCount).toBe(24);
  });

  it('excludes DRAFT and CANCELLED invoices from the outstanding total', async () => {
    const prisma = mockPrisma({});
    const service = createDashboardService(prisma);
    await service.get('user_1');

    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        }),
      })
    );
  });

  it('scopes "this month" payments to the current calendar month only', async () => {
    const prisma = mockPrisma({});
    const service = createDashboardService(prisma);
    await service.get('user_1');

    const call = prisma.payment.aggregate.mock.calls[0][0];
    const monthStart: Date = call.where.paidAt.gte;
    const now = new Date();
    expect(monthStart.getFullYear()).toBe(now.getFullYear());
    expect(monthStart.getMonth()).toBe(now.getMonth());
    expect(monthStart.getDate()).toBe(1);
  });
});
