import 'dotenv/config';
import dns from 'node:dns';

// Force IPv4 first for all DNS queries to prevent IPv6 ENETUNREACH in cloud environments
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { startBackgroundReminderJobs } from './services/cronService.js';

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL',
    'AUTH_SECRET',
    'ADMIN_SECRET',
    'ALLOWED_ORIGINS',
    'PUBLIC_APP_URL',
    'PUBLIC_API_URL',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const hasEmailProvider = Boolean(
    process.env.RESEND_API_KEY?.trim() ||
      process.env.BREVO_API_KEY?.trim() ||
      process.env.GMAIL_HTTP_WEBHOOK_URL?.trim() ||
      (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) ||
      (process.env.GMAIL_CLIENT_ID?.trim() && process.env.GMAIL_CLIENT_SECRET?.trim() && process.env.GMAIL_REFRESH_TOKEN?.trim())
  );
  if (!hasEmailProvider) missing.push('EMAIL_PROVIDER');
  if ((process.env.AUTH_SECRET?.length ?? 0) < 32) missing.push('AUTH_SECRET_MIN_32_CHARS');
  if ((process.env.ADMIN_SECRET?.length ?? 0) < 32) missing.push('ADMIN_SECRET_MIN_32_CHARS');
  for (const key of ['PUBLIC_APP_URL', 'PUBLIC_API_URL']) {
    if (process.env[key] && !process.env[key]!.startsWith('https://')) missing.push(`${key}_HTTPS_REQUIRED`);
  }
  if (missing.length) {
    throw new Error(`Invalid production configuration: ${[...new Set(missing)].join(', ')}`);
  }
}

validateProductionEnvironment();

// 1. Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Wrap the pool in the Prisma driver adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter to PrismaClient
const prisma = new PrismaClient({ adapter });

// 4. Inject prisma into the app factory
const app = createApp(prisma);

// 5. Start automated background reminder jobs
const cronJobs = startBackgroundReminderJobs(prisma);

const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`Follope API listening on ${host}:${port}`);
});

// Graceful shutdown handling
const shutdown = async () => {
  cronJobs.stop();
  server.close(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
