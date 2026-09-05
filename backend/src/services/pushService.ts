import type { PrismaClient } from '@prisma/client';

export interface PushNotificationMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface PushNotificationResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

/**
 * Checks whether a token is a valid Expo push token format.
 */
export function isExpoPushToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  return /^(Expo(nent)?PushToken(\[.+\])|[a-zA-Z0-9-_]{32,})$/.test(token.trim());
}

export function createPushService(prisma: PrismaClient) {
  /**
   * Sends a push notification message directly to Expo's Push API.
   */
  async function sendDirect(message: PushNotificationMessage): Promise<PushNotificationResult> {
    const trimmedToken = message.to.trim();
    if (!isExpoPushToken(trimmedToken)) {
      return { success: false, error: 'INVALID_TOKEN' };
    }

    try {
      const payload = {
        to: trimmedToken,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: message.sound ?? 'default',
        badge: message.badge,
        channelId: message.channelId ?? 'default',
      };

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn('[PushService] Expo Push API HTTP error:', res.status, text);
        return { success: false, error: `HTTP_${res.status}` };
      }

      const json = await res.json() as {
        data?: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }>;
        errors?: Array<{ message: string }>;
      };

      const rawData = json.data;
      const ticket = Array.isArray(rawData) ? rawData[0] : rawData;
      if (ticket?.status === 'ok') {
        return { success: true, ticketId: ticket.id };
      }

      const errorDetail = ticket?.details?.error ?? ticket?.message ?? json.errors?.[0]?.message ?? 'UNKNOWN_ERROR';
      console.warn('[PushService] Expo ticket error:', errorDetail);

      return { success: false, error: errorDetail };
    } catch (err) {
      console.error('[PushService] Failed to send push notification:', err);
      return { success: false, error: 'NETWORK_ERROR' };
    }
  }

  /**
   * Sends a push notification to a user if they have an active registered push token.
   * If the token is reported as DeviceNotRegistered, it automatically nullifies it.
   */
  async function sendToUser(
    userId: string,
    message: Omit<PushNotificationMessage, 'to'>
  ): Promise<PushNotificationResult> {
    if (!prisma.user?.findUnique) {
      return { success: false, error: 'NO_PUSH_TOKEN' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    }).catch(() => null);

    if (!user?.pushToken) {
      return { success: false, error: 'NO_PUSH_TOKEN' };
    }

    const result = await sendDirect({
      ...message,
      to: user.pushToken,
    });

    // Automatically clean up stale/uninstalled tokens
    if (result.error === 'DeviceNotRegistered') {
      await prisma.user.update({
        where: { id: userId },
        data: { pushToken: null },
      }).catch(() => null);
    }

    return result;
  }

  return {
    sendDirect,
    sendToUser,
    isExpoPushToken,
  };
}

export type PushService = ReturnType<typeof createPushService>;
