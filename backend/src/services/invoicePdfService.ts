import PDFDocument from 'pdfkit';
import type { PublicInvoiceView } from './publicInvoiceService.js';

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `Rs. ${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Renders an invoice to a clean, professional A4 PDF buffer.
 * Features:
 * - Brand accent bar and header
 * - Structured Billed To & Invoice Meta cards
 * - Dynamic line-item row height calculation to prevent overlapping text
 * - Clean right-aligned currency columns
 * - Totals breakdown with bold Balance Due callout
 * - Framed UPI Payment section with scannable QR code
 */
export function renderInvoicePdf(invoice: PublicInvoiceView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const contentWidth = pageWidth - 80; // 515.28
    const startX = 40;
    const endX = startX + contentWidth;

    // Top Accent Bar (Follope Orange)
    doc.rect(startX, 25, contentWidth, 4).fill('#FF7A00');

    // 1. Header Section
    let y = 42;
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#111827').text(invoice.business.displayName, startX, y, { width: 320 });
    
    // Right side: INVOICE title & Number
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#111827').text('INVOICE', startX, y, { align: 'right', width: contentWidth });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#FF7A00').text(`#${invoice.invoiceNumber}`, startX, y + 26, { align: 'right', width: contentWidth });

    let leftSubY = y + 26;
    if (invoice.business.gstin) {
      doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text(`GSTIN: ${invoice.business.gstin}`, startX, leftSubY);
      leftSubY += 14;
    }

    y = Math.max(leftSubY + 16, 95);

    // 2. Info Cards (Billed To on Left, Dates & Status on Right)
    const cardY = y;
    const cardWidth = (contentWidth - 16) / 2;

    // Left Card: Billed To
    doc.roundedRect(startX, cardY, cardWidth, 68, 6).fillAndStroke('#F9FAFB', '#E5E7EB');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF').text('BILLED TO', startX + 14, cardY + 12);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text(invoice.clientDisplayName, startX + 14, cardY + 26, { width: cardWidth - 28 });

    // Right Card: Invoice Details
    const rightCardX = startX + cardWidth + 16;
    doc.roundedRect(rightCardX, cardY, cardWidth, 68, 6).fillAndStroke('#F9FAFB', '#E5E7EB');
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF').text('ISSUED ON', rightCardX + 14, cardY + 12);
    doc.fontSize(10).font('Helvetica').fillColor('#111827').text(formatDate(invoice.issueDate), rightCardX + 14, cardY + 24);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF').text('DUE DATE', rightCardX + 130, cardY + 12);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(invoice.status === 'OVERDUE' ? '#DC2626' : '#111827').text(formatDate(invoice.dueDate), rightCardX + 130, cardY + 24);

    const statusLabel = invoice.status.replace('_', ' ');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF').text('STATUS', rightCardX + 14, cardY + 44);
    const statusColor = invoice.status === 'PAID' ? '#16A34A' : invoice.status === 'OVERDUE' ? '#DC2626' : '#D97706';
    doc.fontSize(9).font('Helvetica-Bold').fillColor(statusColor).text(statusLabel, rightCardX + 58, cardY + 44);

    y = cardY + 84;

    // 3. Items Table
    const col = {
      desc: { x: startX + 10, width: 240 },
      qty: { x: startX + 260, width: 45 },
      rate: { x: startX + 315, width: 85 },
      amount: { x: startX + 410, width: 95 },
    };

    // Table Header
    doc.roundedRect(startX, y, contentWidth, 24, 4).fill('#F3F4F6');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4B5563');
    doc.text('ITEM DESCRIPTION', col.desc.x, y + 7, { width: col.desc.width });
    doc.text('QTY', col.qty.x, y + 7, { width: col.qty.width, align: 'center' });
    doc.text('RATE', col.rate.x, y + 7, { width: col.rate.width, align: 'right' });
    doc.text('AMOUNT', col.amount.x, y + 7, { width: col.amount.width, align: 'right' });

    y += 30;

    // Table Body
    for (const item of invoice.items) {
      doc.fontSize(10).font('Helvetica').fillColor('#111827');
      const descHeight = doc.heightOfString(item.description, { width: col.desc.width });
      const rowHeight = Math.max(descHeight + 10, 24);

      if (y + rowHeight > 730) {
        doc.addPage();
        y = 40;
      }

      doc.text(item.description, col.desc.x, y + 2, { width: col.desc.width });
      doc.text(String(item.quantity), col.qty.x, y + 2, { width: col.qty.width, align: 'center' });
      doc.text(formatRupees(item.unitPricePaise), col.rate.x, y + 2, { width: col.rate.width, align: 'right' });
      doc.font('Helvetica-Bold').text(formatRupees(item.lineTotalPaise), col.amount.x, y + 2, { width: col.amount.width, align: 'right' });

      y += rowHeight;
      doc.moveTo(startX, y).lineTo(endX, y).strokeColor('#E5E7EB').lineWidth(0.6).stroke();
      y += 6;
    }

    y += 8;

    // 4. Totals Breakdown (Right Aligned)
    const totalsWidth = 230;
    const totalsX = endX - totalsWidth;
    let totalsY = y;

    const renderTotalRow = (label: string, value: string, isBold = false, isHighlight = false, color = '#111827') => {
      if (isHighlight) {
        doc.roundedRect(totalsX - 10, totalsY - 4, totalsWidth + 10, 28, 4).fill('#FEF3C7');
      }
      doc.fontSize(isBold ? 11 : 9).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(isHighlight ? '#92400E' : '#4B5563');
      doc.text(label, totalsX, totalsY + (isHighlight ? 4 : 0));
      doc.fontSize(isBold ? 11 : 9).font('Helvetica-Bold').fillColor(color);
      doc.text(value, totalsX + 100, totalsY + (isHighlight ? 4 : 0), { width: totalsWidth - 100, align: 'right' });
      totalsY += isHighlight ? 34 : 18;
    };

    renderTotalRow('Subtotal', formatRupees(invoice.subtotalPaise));
    if (invoice.discountPaise > 0) {
      renderTotalRow('Discount', `-${formatRupees(invoice.discountPaise)}`, false, false, '#16A34A');
    }
    if (invoice.taxPaise > 0) {
      renderTotalRow('Tax / GST', `+${formatRupees(invoice.taxPaise)}`);
    }
    renderTotalRow('Total Amount', formatRupees(invoice.totalPaise), true);

    if (invoice.balancePaise > 0 && invoice.balancePaise !== invoice.totalPaise) {
      renderTotalRow('Paid so far', `-${formatRupees(invoice.totalPaise - invoice.balancePaise)}`, false, false, '#16A34A');
    }

    if (invoice.balancePaise > 0) {
      renderTotalRow('Balance Due', formatRupees(invoice.balancePaise), true, true, '#B45309');
    } else {
      renderTotalRow('Amount Settled', formatRupees(invoice.totalPaise), true, true, '#16A34A');
    }

    // 5. Payment Section (UPI QR) on Left
    if (invoice.upi && invoice.balancePaise > 0) {
      const upiCardY = y;
      const upiCardWidth = contentWidth - totalsWidth - 25;
      doc.roundedRect(startX, upiCardY, upiCardWidth, 120, 6).fillAndStroke('#F9FAFB', '#E5E7EB');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('PAY VIA UPI', startX + 14, upiCardY + 12);
      doc.fontSize(8).font('Helvetica').fillColor('#6B7280').text('Scan with Google Pay, PhonePe, Paytm, or BHIM', startX + 14, upiCardY + 25, { width: upiCardWidth - 110 });

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#4B5563').text('UPI ID:', startX + 14, upiCardY + 46);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text(invoice.business.upiId ?? '', startX + 14, upiCardY + 58, { width: upiCardWidth - 110 });

      // Embed QR Code
      try {
        const base64 = invoice.upi.qrCodeDataUrl.split(',')[1];
        if (base64) {
          const qrX = startX + upiCardWidth - 95;
          doc.image(Buffer.from(base64, 'base64'), qrX, upiCardY + 15, { width: 80, height: 80 });
        }
      } catch {
        // Safe fallback if QR fails
      }
    }

    y = Math.max(totalsY + 20, y + 130);

    // 6. Notes & Terms
    if (invoice.notes) {
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF').text('NOTES & INSTRUCTIONS', startX, y);
      doc.fontSize(9).font('Helvetica').fillColor('#4B5563').text(invoice.notes, startX, y + 12, { width: contentWidth });
      y += doc.heightOfString(invoice.notes, { width: contentWidth }) + 20;
    }

    // 7. Footer
    const footerY = 790;
    doc.moveTo(startX, footerY).lineTo(endX, footerY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF').text('Thank you for your business! · Generated via Follope (follope.com)', startX, footerY + 8, {
      align: 'center',
      width: contentWidth,
    });

    doc.end();
  });
}
