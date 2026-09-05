import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createReminderService } from '../services/reminderService.js';
import { createPushService } from '../services/pushService.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

export function createNotificationRouter(prisma: PrismaClient) {
  const router = Router();
  const reminderService = createReminderService(prisma);
  const pushService = createPushService(prisma);

  // All notification endpoints require authentication
  router.use(requireAuth);

  // GET /v1/notifications — List notifications & unread count
  router.get('/', async (req: AuthedRequest, res) => {
    try {
      const data = await reminderService.listNotifications(req.userId!);
      return res.json({ data });
    } catch (err) {
      console.error('[notifications.routes] GET / error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to load notifications' } });
    }
  });

  // POST /v1/notifications/check — Trigger overdue invoice check
  router.post('/check', async (req: AuthedRequest, res) => {
    try {
      const result = await reminderService.checkOverdueInvoices(req.userId!);
      const data = await reminderService.listNotifications(req.userId!);
      return res.json({
        data: {
          ...data,
          summary: result,
        },
      });
    } catch (err) {
      console.error('[notifications.routes] POST /check error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to check overdue invoices' } });
    }
  });

  // PATCH /v1/notifications/:id/read — Mark single notification as read
  router.patch('/:id/read', async (req: AuthedRequest, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const success = await reminderService.markAsRead(req.userId!, id);
      return res.json({ data: { success } });
    } catch (err) {
      console.error('[notifications.routes] PATCH /:id/read error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to mark notification as read' } });
    }
  });

  // POST /v1/notifications/read-all — Mark all notifications as read
  router.post('/read-all', async (req: AuthedRequest, res) => {
    try {
      const result = await reminderService.markAllAsRead(req.userId!);
      return res.json({ data: result });
    } catch (err) {
      console.error('[notifications.routes] POST /read-all error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to mark notifications as read' } });
    }
  });

  // POST /v1/notifications/push-token — Register/update mobile Expo push token
  router.post('/push-token', async (req: AuthedRequest, res) => {
    try {
      const { pushToken } = req.body;
      if (!pushToken || typeof pushToken !== 'string') {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'pushToken is required' } });
      }

      await prisma.user.update({
        where: { id: req.userId! },
        data: { pushToken: pushToken.trim() },
      });

      return res.json({ data: { success: true } });
    } catch (err) {
      console.error('[notifications.routes] POST /push-token error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to update push token' } });
    }
  });

  // DELETE /v1/notifications/push-token — Deregister push token (e.g. on logout)
  router.delete('/push-token', async (req: AuthedRequest, res) => {
    try {
      await prisma.user.update({
        where: { id: req.userId! },
        data: { pushToken: null },
      });
      return res.json({ data: { success: true } });
    } catch (err) {
      console.error('[notifications.routes] DELETE /push-token error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to clear push token' } });
    }
  });

  // POST /v1/notifications/test-push — Send immediate test push to current user
  router.post('/test-push', async (req: AuthedRequest, res) => {
    try {
      const result = await pushService.sendToUser(req.userId!, {
        title: 'Follope Alert',
        body: 'Mobile notifications are active! You will be notified when clients view invoices or make payments.',
        data: { screen: 'notifications' },
        channelId: 'reminders',
      });

      return res.json({
        data: {
          sent: result.success,
          message: result.success
            ? 'Test notification sent to device'
            : (result.error ?? 'Push token not active or device not reachable'),
        },
      });
    } catch (err) {
      console.error('[notifications.routes] POST /test-push error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to send test push' } });
    }
  });

  return router;
}

