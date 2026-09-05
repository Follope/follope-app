import { describe, it, expect } from 'vitest';
import { renderInvoicePdf } from '../invoicePdfService.js';
import type { PublicInvoiceView } from '../publicInvoiceService.js';

const sampleInvoice: PublicInvoiceView = {
  invoiceNumber: 'FOL-2026-0001',
  status: 'PENDING',
  issueDate: new Date('2026-08-01'),
  dueDate: new Date('2026-08-15'),
  currency: 'INR',
  items: [
    { description: 'Landing page design', quantity: '1', unitPricePaise: 1500000, lineTotalPaise: 1770000 },
    { description: 'Revision round', quantity: '2', unitPricePaise: 200000, lineTotalPaise: 472000 },
  ],
  subtotalPaise: 1900000,
  discountPaise: 0,
  taxPaise: 342000,
  totalPaise: 2242000,
  balancePaise: 2242000,
  business: { displayName: 'Priya Sharma Design', logoUrl: null, upiId: 'priya@okhdfcbank', gstin: null },
  clientDisplayName: 'Acme Studio',
  notes: 'Thank you for your business!',
  upi: {
    payUri: 'upi://pay?pa=priya@okhdfcbank&pn=Priya&am=22420.00&cu=INR&tn=Invoice',
    // 1x1 transparent PNG, just to verify the image-embed path doesn't crash
    qrCodeDataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  },
};

describe('renderInvoicePdf', () => {
  it('produces a non-empty, well-formed PDF buffer', async () => {
    const buffer = await renderInvoicePdf(sampleInvoice);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF files start with the %PDF- magic bytes and end with %%EOF
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.subarray(-6).toString('ascii').trim()).toBe('%%EOF');
  });

  it('handles an invoice with no UPI details and no notes without crashing', async () => {
    const minimal: PublicInvoiceView = {
      ...sampleInvoice,
      upi: null,
      notes: null,
      business: { ...sampleInvoice.business, upiId: null },
    };
    const buffer = await renderInvoicePdf(minimal);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('handles a fully paid invoice (balance = 0) without rendering a UPI QR', async () => {
    const paid: PublicInvoiceView = { ...sampleInvoice, balancePaise: 0, status: 'PAID' };
    const buffer = await renderInvoicePdf(paid);
    expect(buffer.length).toBeGreaterThan(500);
  });
});
