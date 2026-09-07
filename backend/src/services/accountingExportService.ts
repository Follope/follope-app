import PDFDocument from 'pdfkit';
import type { PrismaClient } from '@prisma/client';

type ReportInvoice = Awaited<ReturnType<PrismaClient['invoice']['findMany']>>[number];

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `Rs. ${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function getAccountingReport(prisma: PrismaClient, userId: string, from: Date, to: Date) {
  const [business, invoices] = await Promise.all([
    prisma.business.findUnique({ where: { userId } }),
    prisma.invoice.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      include: { client: true, items: true },
      orderBy: { issueDate: 'asc' },
    }),
  ]);
  return { business, invoices };
}

export function renderAccountingCsv(report: Awaited<ReturnType<typeof getAccountingReport>>) {
  const header = [
    'Invoice number', 'Issue date', 'Due date', 'Status', 'Client',
    'Client GSTIN', 'Business GSTIN', 'Subtotal (Rs.)', 'Discount (Rs.)',
    'Tax (Rs.)', 'Total (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)',
    'Item description', 'Qty', 'Tax rate (%)'
  ];
  const rows = report.invoices.flatMap((invoice) => invoice.items.map((item) => [
    invoice.invoiceNumber,
    new Date(invoice.issueDate).toISOString().slice(0, 10),
    new Date(invoice.dueDate).toISOString().slice(0, 10),
    invoice.status,
    invoice.client.name,
    invoice.client.gstin ?? '',
    report.business?.gstin ?? '',
    (invoice.subtotalPaise / 100).toFixed(2),
    (invoice.discountPaise / 100).toFixed(2),
    (invoice.taxPaise / 100).toFixed(2),
    (invoice.totalPaise / 100).toFixed(2),
    (invoice.paidPaise / 100).toFixed(2),
    (invoice.balancePaise / 100).toFixed(2),
    item.description,
    item.quantity.toString(),
    (item.taxRateBps / 100).toFixed(2),
  ].map(csvCell).join(',')));
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

/**
 * Generates a clean, formal executive accounting report PDF.
 * Features:
 * - Clean document header with business info & reporting range
 * - 4 Summary KPI Metric Cards (Invoiced, Received, Outstanding, Tax)
 * - Structured table with right-aligned currency columns
 * - Multi-page pagination support
 */
export function renderAccountingPdf(
  report: Awaited<ReturnType<typeof getAccountingReport>>,
  from: Date,
  to: Date
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const contentWidth = pageWidth - 80;
    const startX = 40;
    const endX = startX + contentWidth;

    // Top Accent Bar
    doc.rect(startX, 25, contentWidth, 4).fill('#FF7A00');

    // Header
    let y = 42;
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827').text(
      report.business?.businessName ?? 'Follope Business',
      startX,
      y
    );
    doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('FINANCIAL & ACCOUNTING REPORT', startX, y + 22);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4B5563').text(
      `Period: ${formatDate(from)} to ${formatDate(to)}`,
      startX,
      y + 10,
      { align: 'right', width: contentWidth }
    );
    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF').text(
      `Generated: ${formatDate(new Date())}`,
      startX,
      y + 24,
      { align: 'right', width: contentWidth }
    );

    y += 50;

    // Financial KPI Summary Cards
    const totalInvoiced = report.invoices.reduce((sum, inv) => sum + inv.totalPaise, 0);
    const totalReceived = report.invoices.reduce((sum, inv) => sum + inv.paidPaise, 0);
    const totalBalance = report.invoices.reduce((sum, inv) => sum + inv.balancePaise, 0);
    const totalTax = report.invoices.reduce((sum, inv) => sum + inv.taxPaise, 0);

    const cards = [
      { label: 'TOTAL INVOICED', value: formatRupees(totalInvoiced), color: '#111827', bg: '#F9FAFB' },
      { label: 'RECEIVED (PAID)', value: formatRupees(totalReceived), color: '#16A34A', bg: '#F0FDF4' },
      { label: 'OUTSTANDING', value: formatRupees(totalBalance), color: '#B45309', bg: '#FEF3C7' },
      { label: 'TAX COLLECTED', value: formatRupees(totalTax), color: '#4B5563', bg: '#F9FAFB' },
    ];

    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap * 3) / 4;

    cards.forEach((card, idx) => {
      const cx = startX + idx * (cardWidth + cardGap);
      doc.roundedRect(cx, y, cardWidth, 54, 5).fillAndStroke(card.bg, '#E5E7EB');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6B7280').text(card.label, cx + 10, y + 10, { width: cardWidth - 20 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(card.color).text(card.value, cx + 10, y + 26, { width: cardWidth - 20 });
    });

    y += 72;

    // Table Header
    const col = {
      date: { x: startX + 8, width: 68 },
      invoice: { x: startX + 78, width: 75 },
      client: { x: startX + 155, width: 125 },
      status: { x: startX + 282, width: 65 },
      total: { x: startX + 349, width: 80 },
      paid: { x: startX + 431, width: 76 },
    };

    const drawTableHeader = (atY: number) => {
      doc.roundedRect(startX, atY, contentWidth, 22, 4).fill('#F3F4F6');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#4B5563');
      doc.text('DATE', col.date.x, atY + 6);
      doc.text('INVOICE #', col.invoice.x, atY + 6);
      doc.text('CLIENT', col.client.x, atY + 6);
      doc.text('STATUS', col.status.x, atY + 6);
      doc.text('TOTAL', col.total.x, atY + 6, { width: col.total.width, align: 'right' });
      doc.text('PAID', col.paid.x, atY + 6, { width: col.paid.width, align: 'right' });
    };

    drawTableHeader(y);
    y += 28;

    if (report.invoices.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('No invoices found for this date range.', startX, y + 10, {
        align: 'center',
        width: contentWidth,
      });
      y += 40;
    } else {
      report.invoices.forEach((inv, index) => {
        if (y > 750) {
          doc.addPage();
          y = 40;
          drawTableHeader(y);
          y += 28;
        }

        // Alternating row background
        if (index % 2 === 1) {
          doc.rect(startX, y - 4, contentWidth, 20).fill('#FAFAFA');
        }

        doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
        doc.text(formatDate(inv.issueDate), col.date.x, y);
        doc.font('Helvetica-Bold').text(inv.invoiceNumber, col.invoice.x, y);
        doc.font('Helvetica').text(inv.client.name, col.client.x, y, { width: col.client.width, ellipsis: true });

        const statusColor = inv.status === 'PAID' ? '#16A34A' : inv.status === 'OVERDUE' ? '#DC2626' : '#D97706';
        doc.font('Helvetica-Bold').fillColor(statusColor).text(inv.status.replace('_', ' '), col.status.x, y);

        doc.font('Helvetica').fillColor('#111827').text(formatRupees(inv.totalPaise), col.total.x, y, { width: col.total.width, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#16A34A').text(formatRupees(inv.paidPaise), col.paid.x, y, { width: col.paid.width, align: 'right' });

        y += 20;
      });

      // Bottom Totals Row
      if (y > 750) {
        doc.addPage();
        y = 40;
      }
      doc.moveTo(startX, y).lineTo(endX, y).strokeColor('#D1D5DB').lineWidth(1).stroke();
      y += 8;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827');
      doc.text(`Total (${report.invoices.length} invoices)`, col.date.x, y);
      doc.text(formatRupees(totalInvoiced), col.total.x, y, { width: col.total.width, align: 'right' });
      doc.fillColor('#16A34A').text(formatRupees(totalReceived), col.paid.x, y, { width: col.paid.width, align: 'right' });
      y += 20;
    }

    // Footer
    const footerY = 790;
    doc.moveTo(startX, footerY).lineTo(endX, footerY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF').text(
      'Follope Accounting Report · follope.com',
      startX,
      footerY + 8,
      { align: 'center', width: contentWidth }
    );

    doc.end();
  });
}
