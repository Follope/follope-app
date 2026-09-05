import type { PrismaClient } from '@prisma/client';
import { createPushService } from './pushService.js';

export interface ReminderNotificationPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  balancePaise: number;
  dueDate: string;
  daysOverdue: number;
  whatsappMessage: string;
  whatsappUrl?: string | null;
  title: string;
  body: string;
}

export function createReminderService(prisma: PrismaClient) {
  const pushService = createPushService(prisma);

  return {
    /**
     * Checks all pending invoices for a user and creates overdue reminder notifications
     * with ready-to-send polite WhatsApp messages.
     */
    async checkOverdueInvoices(userId: string) {
      const now = new Date();

      // Find invoices that are due or past due
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          userId,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING'] },
          dueDate: { lte: now },
        },
        include: {
          client: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      const generatedNotifications = [];

      for (const invoice of overdueInvoices) {
        // Update status to OVERDUE if it was still SENT/VIEWED/PENDING
        if (invoice.status !== 'OVERDUE') {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'OVERDUE' },
          });
        }

        // Check if a reminder for this invoice was already created in the last 24 hours
        const recentNotification = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'invoice_overdue',
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        // Filter in memory for matching invoiceId in payload to prevent duplicate notifications
        const alreadyNotified =
          recentNotification &&
          (recentNotification.payload as any)?.invoiceId === invoice.id;

        if (!alreadyNotified) {
          const diffMs = now.getTime() - new Date(invoice.dueDate).getTime();
          const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          const amountRupees = (invoice.balancePaise / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });

          // Format due date in readable Indian format
          const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          // Generate polite, relationship-preserving WhatsApp follow-up message
          const baseUrl = (process.env.PUBLIC_APP_URL ?? 'https://follope.com').replace(/\/+$/, '');
          const invoiceUrl = `${baseUrl}/invoice/${invoice.publicToken}`;
          const whatsappMessage = daysOverdue === 0
            ? `Hi ${invoice.client.name}, hope you're doing well! Just a quick heads-up that invoice #${invoice.invoiceNumber} for ₹${amountRupees} is due today. You can review and complete payment here: ${invoiceUrl}. Let me know if you need anything else!`
            : `Hi ${invoice.client.name}, hope you're having a great week! Following up regarding invoice #${invoice.invoiceNumber} for ₹${amountRupees}, which was due on ${formattedDueDate} (${daysOverdue} days ago). Please let me know if payment has already been initiated: ${invoiceUrl}. Thank you!`;

          // Generate WhatsApp deep link if client has a phone number
          let whatsappUrl: string | null = null;
          if (invoice.client.phone) {
            const digits = invoice.client.phone.replace(/\D/g, '');
            const phoneWithCountry = digits.length === 10 ? `91${digits}` : digits;
            whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(whatsappMessage)}`;
          }

          const title = `Payment Reminder: ${invoice.client.name}`;
          const body = `Invoice #${invoice.invoiceNumber} for ₹${amountRupees} is ${
            daysOverdue === 0 ? 'due today' : `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`
          }. Tap to send a polite WhatsApp follow-up.`;

          const notification = await prisma.notification.create({
            data: {
              userId,
              type: 'invoice_overdue',
              payload: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientId: invoice.clientId,
                clientName: invoice.client.name,
                clientPhone: invoice.client.phone,
                balancePaise: invoice.balancePaise,
                dueDate: invoice.dueDate.toISOString(),
                daysOverdue,
                whatsappMessage,
                whatsappUrl,
                title,
                body,
              },
            },
          });

          generatedNotifications.push(notification);

          // Dispatch mobile push notification in background
          void pushService.sendToUser(userId, {
            title,
            body,
            data: {
              invoiceId: invoice.id,
              type: 'invoice_overdue',
              screen: 'notifications',
            },
            channelId: 'reminders',
          });
        }
      }

      return {
        checkedCount: overdueInvoices.length,
        newNotificationsCount: generatedNotifications.length,
        notifications: generatedNotifications,
      };
    },

    /**
     * Lists notifications for a user with unread count.
     */
    async listNotifications(userId: string, limit = 50) {
      const [items, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.notification.count({
          where: { userId, readAt: null },
        }),
      ]);

      return { items, unreadCount };
    },

    /**
     * Marks a single notification as read.
     */
    async markAsRead(userId: string, notificationId: string) {
      const result = await prisma.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count > 0;
    },

    /**
     * Marks all notifications as read for a user.
     */
    async markAllAsRead(userId: string) {
      const result = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return { markedCount: result.count };
    },
  };
}
