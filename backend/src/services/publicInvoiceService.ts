import type { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { buildUpiPaymentUri } from './upiService.js';
import { NotFoundError } from './clientService.js';
import { createPushService } from './pushService.js';
import { getUserSubscription } from './subscriptionService.js';

/**
 * Fields exposed on the public invoice page. This is an explicit allow-list,
 * not an exclude-list — new Invoice/User/Client/Business fields added later
 * do NOT leak here automatically. Never include: internal ids, userId,
 * client email/phone/full address (unless the freelancer explicitly opts
 * in), internal notes, audit metadata.
 */
export interface PublicInvoiceView {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  items: Array<{
    description: string;
    quantity: string;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  balancePaise: number;
  business: {
    displayName: string;
    logoUrl: string | null;
    upiId: string | null;
    /** Only surfaced when the invoice has tax applied — GST-registered
     * freelancers are legally required to show their GSTIN on tax invoices
     * so the client can claim input tax credit. Omitted entirely on
     * invoices with no tax, since it's not needed and is otherwise PII
     * best kept off a page anyone with the link can view. */
    gstin: string | null;
  };
  clientDisplayName: string;
  notes: string | null;
  showFollopeBranding?: boolean;
  upi: {
    payUri: string;
    qrCodeDataUrl: string;
  } | null;
}

export function createPublicInvoiceService(prisma: PrismaClient) {
  const pushService = createPushService(prisma);

  return {
    async getByToken(publicToken: string, opts: { markViewed?: boolean; allowInactive?: boolean } = {}): Promise<PublicInvoiceView> {
      const invoice = await prisma.invoice.findUnique({
        where: { publicToken },
        include: { items: true, client: true, user: { include: { business: true } } },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      if (!opts.allowInactive && (!invoice.sentAt || invoice.publicLinkRevokedAt || (invoice.publicLinkExpiresAt && invoice.publicLinkExpiresAt <= new Date()))) {
        // Treat revoked/expired tokens exactly like unknown tokens. This
        // prevents a token holder from learning whether an invoice existed.
        throw new NotFoundError('Invoice not found');
      }

      // Mark viewed — idempotent, only set once, never reset by repeat views.
      if (opts.markViewed !== false && !invoice.viewedAt) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { viewedAt: new Date(), status: invoice.status === 'SENT' ? 'VIEWED' : invoice.status },
        });

        const viewTitle = 'Invoice Viewed';
        const viewBody = `${invoice.client.name} just opened invoice #${invoice.invoiceNumber}.`;
        if (prisma.notification?.create) {
          await prisma.notification.create({
            data: {
              userId: invoice.userId,
              type: 'invoice_viewed',
              payload: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.client.name,
                title: viewTitle,
                body: viewBody,
              },
            },
          }).catch(() => null);
        }

        void pushService.sendToUser(invoice.userId, {
          title: viewTitle,
          body: viewBody,
          data: {
            invoiceId: invoice.id,
            type: 'invoice_viewed',
          },
          channelId: 'default',
        });
      }

      const business = invoice.user.business;
      const businessDisplayName = business?.businessName || invoice.user.name;

      let upi: PublicInvoiceView['upi'] = null;
      // A cancelled invoice must never offer a live UPI payment link. A UPI
      // app cannot know the invoice was cancelled, so showing one here could
      // lead to an accidental, untracked payment.
      if (business?.upiId && invoice.balancePaise > 0 && invoice.status !== 'CANCELLED') {
        try {
          const payUri = buildUpiPaymentUri({
            payeeUpiId: business.upiId,
            payeeName: businessDisplayName,
            amountPaise: invoice.balancePaise,
            invoiceNumber: invoice.invoiceNumber,
          });
          const qrCodeDataUrl = await QRCode.toDataURL(payUri, { margin: 1, width: 320 });
          upi = { payUri, qrCodeDataUrl };
        } catch {
          // A malformed UPI ID shouldn't break the whole public page —
          // just omit the QR and let the client see payment instructions
          // without it.
          upi = null;
        }
      }

      const subDetails = await getUserSubscription(prisma, invoice.userId).catch(() => null);
      const showFollopeBranding = !subDetails?.isPro;

      return {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        items: invoice.items
          .sort((a: (typeof invoice.items)[number], b: (typeof invoice.items)[number]) => a.sortOrder - b.sortOrder)
          .map((item: (typeof invoice.items)[number]) => ({
            description: item.description,
            quantity: item.quantity.toString(),
            unitPricePaise: item.unitPricePaise,
            lineTotalPaise: item.lineTotalPaise,
          })),
        subtotalPaise: invoice.subtotalPaise,
        discountPaise: invoice.discountPaise,
        taxPaise: invoice.taxPaise,
        totalPaise: invoice.totalPaise,
        balancePaise: invoice.balancePaise,
        business: {
          displayName: businessDisplayName,
          logoUrl: business?.logoUrl ?? null,
          upiId: business?.upiId ?? null,
          gstin: invoice.taxPaise > 0 ? business?.gstin ?? null : null,
        },
        clientDisplayName: invoice.client.name,
        notes: invoice.notes,
        showFollopeBranding,
        upi,
      };
    },
  };
}
