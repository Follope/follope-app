/**
 * Gmail HTTP REST Service
 * Sends emails directly via Google's Gmail API (https://gmail.googleapis.com)
 * over standard HTTPS (Port 443).
 *
 * Why this is superior to SMTP:
 * 1. Cloud platforms like Render, AWS, and DigitalOcean block outbound SMTP (ports 25, 465, 587).
 * 2. HTTPS (port 443) is NEVER blocked by cloud firewalls or hosting providers.
 * 3. Supports automatic OAuth2 access token refresh in-memory.
 */

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail?: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Retrieves a fresh Google OAuth2 access token using the refresh token.
 * Tokens are cached in memory for ~55 minutes to minimize network roundtrips.
 */
export async function getGmailAccessToken(config: GmailOAuthConfig): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 300_000) {
    return cachedAccessToken;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh Google OAuth token (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return data.access_token;
}

/**
 * Encodes an email into RFC 2822 format with UTF-8 support and URL-safe Base64.
 */
export function buildRfc2822RawEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;

  const lines = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.html,
    '',
    `--${boundary}--`,
  ];

  const rawMessage = lines.join('\r\n');

  // URL-safe Base64 encode as required by Gmail REST API
  return Buffer.from(rawMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Dispatches an email via the Gmail REST API over HTTPS.
 */
export async function sendViaGmailHttp(
  options: { from: string; to: string; subject: string; html: string; text: string },
  config: GmailOAuthConfig
): Promise<boolean> {
  const accessToken = await getGmailAccessToken(config);
  const raw = buildRfc2822RawEmail(options);

  const userId = encodeURIComponent(config.userEmail || 'me');
  const endpoint = `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GmailHttp] Failed to send email:', response.status, errorText);
    return false;
  }

  const result = (await response.json()) as { id: string };
  console.log(`[GmailHttp] Email sent successfully via HTTP (Message ID: ${result.id}) to ${options.to}`);
  return true;
}

/**
 * Dispatches an email via Google Apps Script Web App Webhook (HTTPS).
 * This allows 1-click sending without OAuth credentials if a webhook URL is provided.
 */
export async function sendViaGmailWebhook(
  options: { from: string; to: string; subject: string; html: string; text: string },
  webhookUrl: string
): Promise<boolean> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GmailWebhook] Failed to send email:', response.status, errorText);
    return false;
  }

  return true;
}
