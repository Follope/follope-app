import { describe, it, expect, vi } from 'vitest';
import { createPaymentService, PaymentError } from '../paymentService.js';
import { NotFoundError } from '../clientService.js';

function mockPrisma(invoice: {
  id: string;
  userId: string;
  status: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  dueDate: Date;
}) {
  const state = { ...invoice };

  return {
    $transaction: vi.fn(async (fn: any) =>
      fn({
        invoice: {
          findUnique: vi.fn(() => Promise.resolve(state)),
          update: vi.fn(({ data }: any) => {
            Object.assign(state, data);
            return Promise.resolve(state);
          }),
        },
        payment: {
          create: vi.fn(({ data }: any) => Promise.resolve({ id: 'payment_1', ...data })),
        },
        auditLog: {
          create: vi.fn(() => Promise.resolve({})),
        },
      })
    ),
    invoice: {
      findUnique: vi.fn(() => Promise.resolve(state)),
    },
    payment: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
  } as any;
}

describe('paymentService — authorization / IDOR', () => {
  const baseInvoice = {
    id: 'inv_1',
    userId: 'user_A',
    status: 'PENDING',
    totalPaise: 100000,
    paidPaise: 0,
    balancePaise: 100000,
    dueDate: new Date(Date.now() + 86400_000),
  };

  it("blocks recording a payment against another user's invoice", async () => {
    const prisma = mockPrisma(baseInvoice);
    const service = createPaymentService(prisma);

    await expect(
      service.record('user_B', 'inv_1', {
        amountPaise: 50000,
        method: 'UPI',
        paidAt: new Date(),
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("blocks listing payments for another user's invoice", async () => {
    const prisma = mockPrisma(baseInvoice);
    const service = createPaymentService(prisma);

    await expect(service.list('user_B', 'inv_1')).rejects.toThrow(NotFoundError);
  });

  it('rejects a payment amount exceeding the remaining balance (overpayment guard)', async () => {
    const prisma = mockPrisma(baseInvoice);
    const service = createPaymentService(prisma);

    await expect(
      service.record('user_A', 'inv_1', {
        amountPaise: 150000, // more than the 100000 balance
        method: 'UPI',
        paidAt: new Date(),
      })
    ).rejects.toThrow(PaymentError);
  });

  it('rejects any payment on a cancelled invoice', async () => {
    const prisma = mockPrisma({ ...baseInvoice, status: 'CANCELLED' });
    const service = createPaymentService(prisma);

    await expect(
      service.record('user_A', 'inv_1', {
        amountPaise: 1000,
        method: 'CASH',
        paidAt: new Date(),
      })
    ).rejects.toThrow(PaymentError);
  });

  it('allows a legitimate owner payment within balance and correctly marks PAID at full payment', async () => {
    const prisma = mockPrisma(baseInvoice);
    const service = createPaymentService(prisma);

    const result = await service.record('user_A', 'inv_1', {
      amountPaise: 100000,
      method: 'UPI',
      paidAt: new Date(),
    });
    expect(result.invoice.status).toBe('PAID');
    expect(result.invoice.balancePaise).toBe(0);
  });
});
