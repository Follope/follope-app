import PDFDocument from 'pdfkit';
import type { PublicInvoiceView } from './publicInvoiceService.js';

// pdfkit's built-in Helvetica font has no ₹ (U+20B9) glyph — it silently
// drops the character rather than erroring, so amounts rendered with ₹
// come out as blank. Use "Rs." until a Unicode font (e.g. Noto Sans,
// embedded via doc.registerFont) is added to the project for a real ₹ glyph.
function formatRupees(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Renders an invoice to a PDF buffer. Takes the same PublicInvoiceView shape
 * the public web page uses, so the PDF and the web page can never drift out
 * of sync with each other — one data shape, two renderers.
 *
 * Layout uses explicit absolute y-coordinates throughout (rather than
 * mixing doc.moveDown with doc.image) so blocks never silently overlap
 * regardless of content length.
 */
export function renderInvoicePdf(invoice: PublicInvoiceView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#0A0A0A').text(invoice.business.displayName, 50, 50);
    doc.fontSize(10).fillColor('#666666').text('Invoice', 50, doc.y);
    if (invoice.business.gstin) {
      doc.fontSize(9).fillColor('#666666').text(`GSTIN: ${invoice.business.gstin}`, 50, doc.y);
    }
    doc.fontSize(16).fillColor('#FF7A00').text(invoice.invoiceNumber, 50, 50, { align: 'right' });

    let y = 100;
    doc.fillColor('#0A0A0A').fontSize(10);
    doc.text(`Issue date: ${formatDate(invoice.issueDate)}`, 50, y);
    doc.text(`Due date: ${formatDate(invoice.dueDate)}`, 50, y + 14);
    doc.text(`Status: ${invoice.status}`, 50, y + 28);
    y += 55;

    // Bill to
    doc.fontSize(11).fillColor('#666666').text('Bill to', 50, y);
    doc.fontSize(12).fillColor('#0A0A0A').text(invoice.clientDisplayName, 50, y + 15);
    y += 45;

    // Items table
    const col = { desc: 50, qty: 300, price: 370, total: 470 };

    doc.fontSize(10).fillColor('#666666');
    doc.text('Description', col.desc, y);
    doc.text('Qty', col.qty, y);
    doc.text('Unit Price', col.price, y);
    doc.text('Total', col.total, y);

    doc.moveTo(50, y + 15).lineTo(545, y + 15).strokeColor('#DDDDDD').stroke();

    let rowY = y + 22;
    doc.fillColor('#0A0A0A');
    for (const item of invoice.items) {
      doc.fontSize(10);
      doc.text(item.description, col.desc, rowY, { width: 240 });
      doc.text(item.quantity, col.qty, rowY);
      doc.text(formatRupees(item.unitPricePaise), col.price, rowY);
      doc.text(formatRupees(item.lineTotalPaise), col.total, rowY);
      rowY += 20;
    }

    doc.moveTo(50, rowY + 5).lineTo(545, rowY + 5).strokeColor('#DDDDDD').stroke();

    // Totals
    let totalsY = rowY + 15;
    const totalsLine = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10).fillColor(bold ? '#0A0A0A' : '#666666');
      doc.text(label, 370, totalsY);
      doc.text(value, col.total, totalsY);
      totalsY += bold ? 20 : 16;
    };

    totalsLine('Subtotal', formatRupees(invoice.subtotalPaise));
    if (invoice.discountPaise > 0) totalsLine('Discount', `-${formatRupees(invoice.discountPaise)}`);
    if (invoice.taxPaise > 0) totalsLine('Tax', formatRupees(invoice.taxPaise));
    totalsLine('Total', formatRupees(invoice.totalPaise), true);
    if (invoice.balancePaise !== invoice.totalPaise) {
      totalsLine('Balance due', formatRupees(invoice.balancePaise), true);
    }

    y = totalsY + 30;

    // Payment instructions
    if (invoice.upi && invoice.balancePaise > 0) {
      doc.fontSize(11).fillColor('#666666').text('Payment', 50, y);
      doc.fontSize(10).fillColor('#0A0A0A').text(`UPI ID: ${invoice.business.upiId}`, 50, y + 15);
      const qrSize = 120;
      try {
        const base64 = invoice.upi.qrCodeDataUrl.split(',')[1];
        doc.image(Buffer.from(base64, 'base64'), 50, y + 32, { width: qrSize });
        y += 32 + qrSize + 20; // advance past the QR image's actual footprint
      } catch {
        // If the QR image fails to embed, the PDF still has the UPI ID as
        // text — never let PDF generation hard-fail on this.
        y += 32 + 20;
      }
    }

    if (invoice.notes) {
      doc.fontSize(9).fillColor('#666666').text(invoice.notes, 50, y, { width: 495 });
    }

    doc.end();
  });
}

