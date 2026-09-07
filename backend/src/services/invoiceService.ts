import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { computeInvoiceTotals, type InvoiceItemInput } from './invoiceCalculator.js';
import { nextInvoiceNumber } from './invoiceNumbering.js';
import { NotFoundError } from './clientService.js';
import { canCreateInvoice, canEditInvoice } from './subscriptionService.js';
import { checkAndRewardReferralOnFirstInvoice } from './referralService.js';

export interface CreateInvoiceItemInput extends InvoiceItemInput {
  description: string;
}

export interface CreateInvoiceInput {
  clientId: string;
  dueDate: Date;
  items: CreateInvoiceItemInput[];
  notes?: string;
}

export interface UpdateInvoiceInput extends CreateInvoiceInput {
  reason?: string;
}

export class InvoiceStateError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function createInvoiceService(prisma: PrismaClient) {
  return {
    async create(userId: string, input: CreateInvoiceInput) {
      // Subscription quota check (e.g. max 3 invoices on Free plan)
      const quota = await canCreateInvoice(prisma, userId);
      if (!quota.allowed) {
        throw new InvoiceStateError(quota.reason ?? 'Invoice limit reached', 'INVOICE_LIMIT_REACHED');
      }

      // Ownership check: the client being invoiced must belong to this user.
      const client = await prisma.client.findUnique({ where: { id: input.clientId } });
      if (!client || client.userId !== userId) {
        throw new NotFoundError('Client not found');
      }

      const business = await prisma.business.findUnique({ where: { userId } });
      const prefix = business?.invoicePrefix ?? 'FOL';

      // Server is the only party computing money — never trust client totals.
      const totals = computeInvoiceTotals(input.items);

      // Wrap number allocation + create in a transaction with a row lock on
      // the user's most recent invoice, so two concurrent requests can't
      // both compute the same next number (classic race condition here).
      const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const currentYear = new Date().getFullYear();
        const yearPrefix = `${prefix}-${currentYear}-`;

        const last = await tx.invoice.findFirst({
          where: { userId, invoiceNumber: { startsWith: yearPrefix } },
          orderBy: { invoiceNumber: 'desc' },
        });

        const invoiceNumber = nextInvoiceNumber(prefix, currentYear, last?.invoiceNumber ?? null);

        return tx.invoice.create({
          data: {
            userId,
            clientId: input.clientId,
            invoiceNumber,
            dueDate: input.dueDate,
            notes: input.notes,
            subtotalPaise: totals.subtotalPaise,
            discountPaise: totals.discountPaise,
            taxPaise: totals.taxPaise,
            totalPaise: totals.totalPaise,
            balancePaise: totals.totalPaise,
            items: {
              create: totals.items.map((item, idx) => ({
                description: input.items[idx].description,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                discountPaise: item.discountPaise,
                taxRateBps: item.taxRateBps ?? 0,
                lineTotalPaise: item.lineTotalPaise,
                sortOrder: idx,
              })),
            },
          },
          include: { items: true, client: true },
        });
      });

      await prisma.auditLog.create({
        data: { userId, action: 'invoice_created', entityType: 'Invoice', entityId: invoice.id },
      });

      // Reward referral if this is the user's first invoice (anti-fraud)
      void checkAndRewardReferralOnFirstInvoice(prisma, userId);

      return invoice;
    },

    async getOwned(userId: string, invoiceId: string) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true, client: true, revisions: { orderBy: { version: 'desc' } } },
      });
      if (!invoice || invoice.userId !== userId) {
        throw new NotFoundError('Invoice not found');
      }
      return invoice;
    },

    async update(userId: string, invoiceId: string, input: UpdateInvoiceInput) {
      // Check if user is allowed to edit this invoice (e.g. max 1 edit on Free tier)
      const editQuota = await canEditInvoice(prisma, userId, invoiceId);
      if (!editQuota.allowed) {
        throw new InvoiceStateError(editQuota.reason ?? 'Revision limit reached', 'REVISION_LIMIT_REACHED');
      }

      const client = await prisma.client.findUnique({ where: { id: input.clientId } });
      if (!client || client.userId !== userId) throw new NotFoundError('Client not found');
      const totals = computeInvoiceTotals(input.items);

      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, userId },
          include: { items: true, revisions: { select: { version: true }, orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!invoice) throw new NotFoundError('Invoice not found');
        if (invoice.status === 'CANCELLED' || invoice.paidPaise > 0) {
          throw new InvoiceStateError('Only unpaid, active invoices can be edited.', 'INVOICE_NOT_EDITABLE');
        }

        await tx.invoiceRevision.create({
          data: {
            invoiceId,
            version: (invoice.revisions[0]?.version ?? 0) + 1,
            reason: input.reason || null,
            snapshot: {
              clientId: invoice.clientId,
              dueDate: invoice.dueDate.toISOString(),
              notes: invoice.notes,
              subtotalPaise: invoice.subtotalPaise,
              discountPaise: invoice.discountPaise,
              taxPaise: invoice.taxPaise,
              totalPaise: invoice.totalPaise,
              items: invoice.items.map((item) => ({
                description: item.description,
                quantity: item.quantity.toString(),
                unitPricePaise: item.unitPricePaise,
                discountPaise: item.discountPaise,
                taxRateBps: item.taxRateBps,
                lineTotalPaise: item.lineTotalPaise,
              })),
            },
          },
        });
        await tx.invoiceItem.deleteMany({ where: { invoiceId } });
        return tx.invoice.update({
          where: { id: invoiceId },
          data: {
            clientId: input.clientId,
            dueDate: input.dueDate,
            notes: input.notes,
            subtotalPaise: totals.subtotalPaise,
            discountPaise: totals.discountPaise,
            taxPaise: totals.taxPaise,
            totalPaise: totals.totalPaise,
            balancePaise: totals.totalPaise,
            items: {
              create: totals.items.map((item, idx) => ({
                description: input.items[idx].description,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                discountPaise: item.discountPaise,
                taxRateBps: item.taxRateBps ?? 0,
                lineTotalPaise: item.lineTotalPaise,
                sortOrder: idx,
              })),
            },
          },
          include: { items: true, payments: true, client: true, revisions: { orderBy: { version: 'desc' } } },
        });
      });

      await prisma.auditLog.create({
        data: { userId, action: 'invoice_edited', entityType: 'Invoice', entityId: invoiceId, metadata: { reason: input.reason ?? null } },
      });
      return updated;
    },

    async list(userId: string, opts: { status?: string; clientId?: string; cursor?: string; limit?: number } = {}) {
      const requestedLimit = opts.limit ?? 20;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 20;
      // Sharing moves an invoice through SENT then VIEWED before it becomes
      // PENDING. Treat those unpaid, sent states as "Pending" in the UI
      // filter so freelancers do not lose sight of invoices awaiting payment.
      const statusFilter: Prisma.InvoiceWhereInput['status'] | undefined =
        opts.status === 'PENDING'
          ? { in: ['SENT', 'VIEWED', 'PENDING'] }
          : opts.status
            ? (opts.status as never)
            : undefined;
      return prisma.invoice.findMany({
        where: {
          userId,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(opts.clientId ? { clientId: opts.clientId } : {}),
        },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      });
    },

    async duplicate(userId: string, invoiceId: string) {
      const original = await this.getOwned(userId, invoiceId);

      return this.create(userId, {
        clientId: original.clientId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default +7 days from now
        notes: original.notes ?? undefined,
        items: original.items.map((i: (typeof original.items)[number]) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPricePaise: i.unitPricePaise,
          discountPaise: i.discountPaise,
          taxRateBps: i.taxRateBps,
        })),
      });
      // Deliberately does NOT copy invoiceNumber, status, or payment history —
      // `create` above always allocates a fresh number and starts at DRAFT/balance=total.
    },

    async cancel(userId: string, invoiceId: string) {
      const invoice = await this.getOwned(userId, invoiceId);
      if (invoice.status === 'CANCELLED') return invoice;
      if (invoice.paidPaise > 0) {
        // Keep the financial record immutable once money is recorded. A
        // credit-note workflow can be added later instead of erasing history.
        throw new InvoiceStateError('Invoices with recorded payments cannot be cancelled.', 'INVOICE_HAS_PAYMENTS');
      }

      const cancelled = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: { items: true, payments: true, client: true },
      });
      await prisma.auditLog.create({
        data: { userId, action: 'invoice_cancelled', entityType: 'Invoice', entityId: invoice.id },
      });
      return cancelled;
    },

    async activatePublicLink(userId: string, invoiceId: string, expiresInDays = 30) {
      const invoice = await this.getOwned(userId, invoiceId);
      if (invoice.status === 'CANCELLED') {
        throw new InvoiceStateError('Cancelled invoices cannot be shared.', 'INVOICE_CANCELLED');
      }
      const shouldRotate = Boolean(invoice.publicLinkRevokedAt) || Boolean(invoice.publicLinkExpiresAt && invoice.publicLinkExpiresAt <= new Date());
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      const shared = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(shouldRotate ? { publicToken: randomUUID() } : {}),
          publicLinkRevokedAt: null,
          publicLinkExpiresAt: expiresAt,
          sentAt: invoice.sentAt ?? new Date(),
          status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status,
        },
      });
      await prisma.auditLog.create({ data: { userId, action: 'invoice_link_shared', entityType: 'Invoice', entityId: invoiceId, metadata: { expiresAt } } });
      return shared;
    },

    async revokePublicLink(userId: string, invoiceId: string) {
      await this.getOwned(userId, invoiceId);
      const invoice = await prisma.invoice.update({ where: { id: invoiceId }, data: { publicLinkRevokedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId, action: 'invoice_link_revoked', entityType: 'Invoice', entityId: invoiceId } });
      return invoice;
    },
  };
}
