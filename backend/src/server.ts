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