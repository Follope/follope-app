import { describe, it, expect, vi } from 'vitest';
import { createInvoiceService } from '../invoiceService.js';
import { NotFoundError } from '../clientService.js';

function mockPrisma(opts: {
  clients?: Record<string, { id: string; userId: string }>;
  invoices?: Record<string, { id: string; userId: string; clientId: string; invoiceNumber: string }>;
}) {
  const clients = opts.clients ?? {};
  const invoices = opts.invoices ?? {};

  return {
    client: {
      findUnique: vi.fn(({ where }: any) => Promise.resolve(clients[where.id] ?? null)),
    },
    business: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
    invoice: {
      findUnique: vi.fn(({ where }: any) => Promise.resolve(invoices[where.id] ?? null)),
      findFirst: vi.fn(() => Promise.resolve(null)),
      findMany: vi.fn(() => Promise.resolve(Object.values(invoices))),
      update: vi.fn(({ where, data }: any) =>
        Promise.resolve({ ...invoices[where.id], ...data, items: [], payments: [], client: {} })
      ),
      count: vi.fn(() => Promise.resolve(0)),
    },
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'sub_1', ...data })),
      update: vi.fn(({ data }: any) => Promise.resolve({ id: 'sub_1', ...data })),
    },
    planConfig: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: 'default',
          freeInvoiceLimit: 3,
          maxInvoiceEdits: 1,
          referralRewardMonths: 1,
          proMonthlyPricePaise: 29900,
          proAnnualPricePaise: 249900,
          lifetimePricePaise: 499900,
        })
      ),
    },
    referral: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
    auditLog: {
      create: vi.fn(() => Promise.resolve({})),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        invoice: {
          findFirst: vi.fn(() => Promise.resolve(null)),
          create: vi.fn(({ data }: any) => Promise.resolve({ id: 'new_invoice', ...data, items: [] })),
        },
      })
    ),
  } as any;
}

describe('invoiceService — authorization / IDOR', () => {
  it('blocks creating an invoice against a client owned by a different user', async () => {
    const prisma = mockPrisma({
      clients: { client_1: { id: 'client_1', userId: 'user_B' } }, // owned by B, not A
    });
    const service = createInvoiceService(prisma);

    await expect(
      service.create('user_A', {
        clientId: 'client_1',
        dueDate: new Date(),
        items: [{ description: 'Work', quantity: 1, unitPricePaise: 1000 }],
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('allows creating an invoice against a client the user actually owns', async () => {
    const prisma = mockPrisma({
      clients: { client_1: { id: 'client_1', userId: 'user_A' } },
    });
    const service = createInvoiceService(prisma);

    const invoice = await service.create('user_A', {
      clientId: 'client_1',
      dueDate: new Date(),
      items: [{ description: 'Work', quantity: 1, unitPricePaise: 1000 }],
    });
    expect(invoice.userId).toBe('user_A');
  });

  it("blocks reading another user's invoice by id (getOwned)", async () => {
    const prisma = mockPrisma({
      invoices: { inv_1: { id: 'inv_1', userId: 'user_A', clientId: 'client_1', invoiceNumber: 'FOL-2026-0001' } },
    });
    const service = createInvoiceService(prisma);

    await expect(service.getOwned('user_B', 'inv_1')).rejects.toThrow(NotFoundError);
  });

  it("blocks duplicating another user's invoice", async () => {
    const prisma = mockPrisma({
      invoices: { inv_1: { id: 'inv_1', userId: 'user_A', clientId: 'client_1', invoiceNumber: 'FOL-2026-0001' } },
    });
    const service = createInvoiceService(prisma);

    await expect(service.duplicate('user_B', 'inv_1')).rejects.toThrow(NotFoundError);
  });

  it('cancels only an unpaid invoice owned by the current user and records an audit entry', async () => {
    const prisma = mockPrisma({
      invoices: { inv_1: { id: 'inv_1', userId: 'user_A', clientId: 'client_1', invoiceNumber: 'FOL-2026-0001' } },
    });
    const service = createInvoiceService(prisma);

    const cancelled = await service.cancel('user_A', 'inv_1');

    expect(cancelled.status).toBe('CANCELLED');
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv_1' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'invoice_cancelled', userId: 'user_A' }),
    }));
  });

  it('never trusts a client-supplied total — computes totalPaise from items regardless of what a malicious payload might imply', async () => {
    const prisma = mockPrisma({
      clients: { client_1: { id: 'client_1', userId: 'user_A' } },
    });
    const service = createInvoiceService(prisma);

    // Even though CreateInvoiceInput's type doesn't expose a totalPaise
    // field at all, this asserts the service only ever derives totals
    // from computeInvoiceTotals — a spot-check that the calculation path
    // is actually wired, not bypassable via extra fields on the input object.
    const maliciousInput = {
      clientId: 'client_1',
      dueDate: new Date(),
      items: [{ description: 'Work', quantity: 2, unitPricePaise: 50000 }],
      totalPaise: 1,
    };
    const invoice = await service.create('user_A', maliciousInput);
    expect(invoice.totalPaise).toBe(100000); // 2 * 50000, not the injected 1
  });
});
