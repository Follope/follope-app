import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPublicInvoiceService } from '../services/publicInvoiceService.js';
import { renderInvoicePdf } from '../services/invoicePdfService.js';
import { NotFoundError } from '../services/clientService.js';
import { publicInvoiceRateLimit } from '../middleware/rateLimit.js';

export function createPublicRouter(prisma: PrismaClient) {
  const router = Router();
  const publicInvoiceService = createPublicInvoiceService(prisma);

  router.get('/invoices/:publicToken', publicInvoiceRateLimit, async (req, res) => {
    try {
      const invoice = await publicInvoiceService.getByToken(String(req.params.publicToken));
      return res.json({ data: invoice });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      }
      console.error(err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.get('/invoices/:publicToken/pdf', publicInvoiceRateLimit, async (req, res) => {
    try {
      const invoice = await publicInvoiceService.getByToken(String(req.params.publicToken), {
        markViewed: false,
        allowInactive: true,
      });
      const pdf = await renderInvoicePdf(invoice);
      const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdf);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      }
      console.error(err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  return router;
}

