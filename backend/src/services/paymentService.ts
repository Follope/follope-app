import type { Prisma, PrismaClient } from '@prisma/client';
import { computeBalanceAndStatus } from './invoiceCalculator.js';
import { NotFoundError } from './clientService.js';
import { createPushService } from './pushService.js';

export class PaymentError extends Error {
  constructor(message: string, public code: string = 'PAYMENT_ERROR') {
    super(message);
  }
}

export interface RecordPaymentInput {
  amountPaise: number;
  method: 'UPI' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  paidAt: Date;
  referenceId?: string;
  notes?: string;
}

export function createPaymentService(prisma: PrismaClient) {
  const pushService = createPushService(prisma);

  return {
    async record(userId: string, invoiceId: string, input: RecordPaymentInput) {
      // See note in invoiceService.ts — `tx` is fully typed as
      // Prisma.TransactionClient once the real client is generated.
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice || invoice.userId !== userId) {
          throw new NotFoundError('Invoice not found');
        }
        if (invoice.status === 'CANCELLED') {
          throw new PaymentError('Cannot record a payment against a cancelled invoice', 'INVOICE_CANCELLED');
        }
        if (input.amountPaise > invoice.balancePaise) {
          throw new PaymentError(
            `Payment (${input.amountPaise}) exceeds remaining balance (${invoice.balancePaise})`,
            'AMOUNT_EXCEEDS_BALANCE'
          );
        }
        if (input.method === 'UPI' && input.referenceId) {
          const existing = await tx.payment.findFirst({
            where: { method: 'UPI', referenceId: input.referenceId },
            select: { id: true },
          });
          if (existing) {
            throw new PaymentError('This UPI reference has already been reconciled against another payment.', 'DUPLICATE_UPI_REFERENCE');
          }
        }

        const payment = await tx.payment.create({
          data: {
            invoiceId,
            amountPaise: input.amountPaise,
            method: input.method,
            paidAt: input.paidAt,
            referenceId: input.referenceId,
            notes: input.notes,
            reconciledAt: input.method === 'UPI' && input.referenceId ? new Date() : null,
          },
        });

        const newPaidTotal = invoice.paidPaise + input.amountPaise;
        const { balancePaise, status } = computeBalanceAndStatus(
          invoice.totalPaise,
          newPaidTotal,
          invoice.status,
          invoice.dueDate
        );

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidPaise: newPaidTotal,
            balancePaise,
            status,
            paidAt: status === 'PAID' ? new Date() : invoice.paidAt,
          },
          include: {
            client: true,
            items: true,
            revisions: { orderBy: { version: 'desc' } },
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'payment_recorded',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { invoiceId, amountPaise: input.amountPaise, method: input.method, referenceId: input.referenceId ?? null },
          },
        });

        const amountRupees = (input.amountPaise / 100).toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        const payTitle = 'Payment Received!';
        const payBody = `₹${amountRupees} payment recorded for invoice #${invoice.invoiceNumber}.`;

        if ((tx as any).notification?.create) {
          await (tx as any).notification.create({
            data: {
              userId,
              type: 'payment_received',
              payload: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amountPaise: input.amountPaise,
                title: payTitle,
                body: payBody,
              },
            },
          }).catch(() => null);
        }

        return { payment, invoice: updatedInvoice, payTitle, payBody };
      });

      // Dispatch push notification asynchronously outside transaction
      void pushService.sendToUser(userId, {
        title: result.payTitle,
        body: result.payBody,
        data: {
          invoiceId,
          type: 'payment_received',
        },
        channelId: 'default',
      });

      return { payment: result.payment, invoice: result.invoice };
    },

    async list(userId: string, invoiceId: string) {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.userId !== userId) {
        throw new NotFoundError('Invoice not found');
      }
      return prisma.payment.findMany({ where: { invoiceId }, orderBy: { paidAt: 'desc' } });
    },
  };
}
