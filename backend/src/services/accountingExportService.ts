import PDFDocument from 'pdfkit';
import type { PrismaClient } from '@prisma/client';

type ReportInvoice = Awaited<ReturnType<PrismaClient['invoice']['findMany']>>[number];

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function date(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
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
  const header = ['Invoice number', 'Issue date', 'Due date', 'Status', 'Client', 'Client GSTIN', 'Business GSTIN', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Item description', 'Qty', 'Tax rate (%)'];
  const rows = report.invoices.flatMap((invoice) => invoice.items.map((item) => [
    invoice.invoiceNumber, date(invoice.issueDate), date(invoice.dueDate), invoice.status, invoice.client.name,
    invoice.client.gstin ?? '', report.business?.gstin ?? '', invoice.subtotalPaise / 100, invoice.discountPaise / 100,
    invoice.taxPaise / 100, invoice.totalPaise / 100, invoice.paidPaise / 100, invoice.balancePaise / 100,
    item.description, item.quantity.toString(), item.taxRateBps / 100,
  ].map(csvCell).join(',')));
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

export function renderAccountingPdf(report: Awaited<ReturnType<typeof getAccountingReport>>, from: Date, to: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const total = report.invoices.reduce((sum, invoice) => sum + invoice.totalPaise, 0);
    const paid = report.invoices.reduce((sum, invoice) => sum + invoice.paidPaise, 0);
    const tax = report.invoices.reduce((sum, invoice) => sum + invoice.taxPaise, 0);
    doc.fontSize(20).fillColor('#0A0A0A').text(`${report.business?.businessName ?? 'Follope'} accounting report`);
    doc.fontSize(10).fillColor('#666666').text(`${date(from)} to ${date(to)}`);
    doc.moveDown();
    doc.fillColor('#0A0A0A').fontSize(11).text(`Invoices: ${report.invoices.length}   Invoiced: Rs. ${(total / 100).toFixed(2)}   Received: Rs. ${(paid / 100).toFixed(2)}   Tax: Rs. ${(tax / 100).toFixed(2)}`);
    doc.moveDown();
    report.invoices.forEach((invoice) => {
      doc.fontSize(11).fillColor('#0A0A0A').text(`${invoice.invoiceNumber}  ·  ${invoice.client.name}`, { continued: true });
      doc.fillColor('#666666').text(`  ${invoice.status}  ·  Rs. ${(invoice.totalPaise / 100).toFixed(2)}`, { align: 'right' });
      doc.fontSize(9).fillColor('#666666').text(`Issued ${date(invoice.issueDate)} | Tax Rs. ${(invoice.taxPaise / 100).toFixed(2)} | Balance Rs. ${(invoice.balancePaise / 100).toFixed(2)}`);
      doc.moveDown(0.6);
    });
    doc.end();
  });
}
