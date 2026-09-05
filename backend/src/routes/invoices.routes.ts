import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createInvoiceService, InvoiceStateError } from '../services/invoiceService.js';
import { createPaymentService, PaymentError } from '../services/paymentService.js';
import { createPublicInvoiceService } from '../services/publicInvoiceService.js';
import { renderInvoicePdf } from '../services/invoicePdfService.js';
import { getAccountingReport, renderAccountingCsv, renderAccountingPdf } from '../services/accountingExportService.js';
import { NotFoundError } from '../services/clientService.js';
import { createInvoiceSchema, updateInvoiceSchema, recordPaymentSchema, shareInvoiceSchema } from '../lib/validation.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { idempotency } from '../middleware/idempotency.js';

function handleError(err: unknown, res: import('express').Response) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
  }
  if (err instanceof PaymentError) {
    return res.status(400).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof InvoiceStateError) {
    return res.status(400).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof Error && /must have at least one item|quantity|unitPricePaise|discountPaise|taxRateBps/.test(err.message)) {
    // calculation-layer validation errors — surface as 400s, not 500s
    return res.status(400).json({ error: { code: 'INVALID_INVOICE', message: err.message } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}

const VALID_INVOICE_STATUSES = new Set([
  'DRAFT', 'SENT', 'VIEWED', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED',
]);

export function createInvoicesRouter(prisma: PrismaClient) {
  const router = Router();
  const invoiceService = createInvoiceService(prisma);
  const paymentService = createPaymentService(prisma);
  const publicInvoiceService = createPublicInvoiceService(prisma);
  const idempotencyGuard = idempotency();

  router.use(requireAuth);

  router.get('/', async (req: AuthedRequest, res) => {
    try {
      const { status, clientId, cursor, limit } = req.query;

      if (typeof status === 'string' && !VALID_INVOICE_STATUSES.has(status)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Invalid status filter: ${status}` },
        });
      }

      const invoices = await invoiceService.list(req.userId!, {
        status: typeof status === 'string' ? status : undefined,
        clientId: typeof clientId === 'string' ? clientId : undefined,
        cursor: typeof cursor === 'string' ? cursor : undefined,
        limit: typeof limit === 'string' ? Number(limit) : undefined,
      });
      return res.json({ data: invoices });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/', idempotencyGuard, async (req: AuthedRequest, res) => {
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      const invoice = await invoiceService.create(req.userId!, {
        clientId: parsed.data.clientId,
        dueDate: new Date(parsed.data.dueDate),
        notes: parsed.data.notes,
        items: parsed.data.items,
      });
      return res.status(201).json({ data: invoice });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.get('/export.:format', async (req: AuthedRequest, res) => {
    const format = String(req.params.format).toLowerCase();
    if (format !== 'csv' && format !== 'pdf') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Export format must be csv or pdf' } });
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Use a valid export date range' } });
    }
    to.setHours(23, 59, 59, 999);
    try {
      const report = await getAccountingReport(prisma, req.userId!, from, to);
      const suffix = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="follope_accounting_${suffix}.csv"`);
        return res.send(renderAccountingCsv(report));
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="follope_accounting_${suffix}.pdf"`);
      return res.send(await renderAccountingPdf(report, from, to));
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.get('/:id', async (req: AuthedRequest, res) => {
    try {
      const invoice = await invoiceService.getOwned(req.userId!, String(req.params.id));
      return res.json({ data: invoice });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const parsed = updateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
    }
    try {
      const invoice = await invoiceService.update(req.userId!, String(req.params.id), {
        ...parsed.data,
        dueDate: new Date(parsed.data.dueDate),
      });
      return res.json({ data: invoice });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/duplicate', async (req: AuthedRequest, res) => {
    try {
      const invoice = await invoiceService.duplicate(req.userId!, String(req.params.id));
      return res.status(201).json({ data: invoice });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/cancel', async (req: AuthedRequest, res) => {
    try {
      const invoice = await invoiceService.cancel(req.userId!, String(req.params.id));
      return res.json({ data: invoice });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.get('/:id/pdf', async (req: AuthedRequest, res) => {
    try {
      const invoice = await invoiceService.getOwned(req.userId!, String(req.params.id));
      // Generating a PDF for the sender must not count as the client viewing it.
      const publicInvoice = await publicInvoiceService.getByToken(invoice.publicToken, { markViewed: false, allowInactive: true });
      const pdf = await renderInvoicePdf(publicInvoice);
      const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdf);
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/share', async (req: AuthedRequest, res) => {
    const parsed = shareInvoiceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid expiry period' } });
    }
    try {
      const invoice = await invoiceService.activatePublicLink(req.userId!, String(req.params.id), parsed.data.expiresInDays ?? 30);
      const baseUrl = (process.env.PUBLIC_APP_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
      const publicUrl = `${baseUrl}/invoice/${invoice.publicToken}`;
      return res.json({ data: { publicUrl, expiresAt: invoice.publicLinkExpiresAt } });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/revoke-link', async (req: AuthedRequest, res) => {
    try {
      await invoiceService.revokePublicLink(req.userId!, String(req.params.id));
      return res.json({ data: { success: true } });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/reminder', async (req: AuthedRequest, res) => {
    try {
      const invoice = await invoiceService.getOwned(req.userId!, String(req.params.id));
      if (invoice.balancePaise <= 0) {
        return res.status(400).json({
          error: { code: 'ALREADY_PAID', message: 'This invoice is already fully paid.' },
        });
      }
      await prisma.reminder.create({ data: { invoiceId: invoice.id, channel: 'manual_link' } });
      const baseUrl = (process.env.PUBLIC_APP_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
      const publicUrl = `${baseUrl}/invoice/${invoice.publicToken}`;
      const reminderText = `Hi, just a quick reminder that invoice ${invoice.invoiceNumber} for ₹${(
        invoice.balancePaise / 100
      ).toFixed(2)} is currently ${invoice.status === 'OVERDUE' ? 'overdue' : 'pending'}. You can view and pay it here: ${publicUrl}`;
      return res.status(201).json({ data: { success: true, reminderText } });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/:id/payments', idempotencyGuard, async (req: AuthedRequest, res) => {
    const parsed = recordPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      const result = await paymentService.record(req.userId!, String(req.params.id), {
        ...parsed.data,
        paidAt: new Date(parsed.data.paidAt),
      });
      return res.status(201).json({ data: result });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.get('/:id/payments', async (req: AuthedRequest, res) => {
    try {
      const payments = await paymentService.list(req.userId!, String(req.params.id));
      return res.json({ data: payments });
    } catch (err) {
      return handleError(err, res);
    }
  });

  return router;
}
