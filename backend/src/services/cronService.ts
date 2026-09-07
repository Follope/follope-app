import type { PrismaClient } from '@prisma/client';
import { createReminderService } from './reminderService.js';

/**
 * Background cron runner for Follope backend.
 * Periodically scans for overdue invoices and triggers notifications & push alerts
 * so users receive follow-up alerts like WhatsApp/banking apps even when the mobile app is closed.
 */
export function startBackgroundReminderJobs(prisma: PrismaClient) {
  const reminderService = createReminderService(prisma);

  async function runReminderSweep() {
    try {
      // Find all distinct users who have pending/active invoices
      const usersWithPendingInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING'] },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      for (const { userId } of usersWithPendingInvoices) {
        try {
          await reminderService.checkOverdueInvoices(userId);
        } catch (err) {
          console.error(`[Cron] Error checking reminders for user ${userId}:`, err);
        }
      }
    } catch (err) {
      console.error('[Cron] Error running global reminder sweep:', err);
    }
  }

  // Run initial sweep 30s after server boot
  const initialTimer = setTimeout(() => {
    void runReminderSweep();
  }, 30_000);

  // Then run every 1 hour
  const intervalId = setInterval(() => {
    void runReminderSweep();
  }, 60 * 60 * 1000);

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    },
    runNow: runReminderSweep,
  };
}
