import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { PrismaClient } from '@prisma/client';
import { createAuthRouter } from './routes/auth.routes.js';
import { createClientsRouter } from './routes/clients.routes.js';
import { createInvoicesRouter } from './routes/invoices.routes.js';
import { createPublicRouter } from './routes/public.routes.js';
import { createMeRouter } from './routes/me.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createNotificationRouter } from './routes/notifications.routes.js';
import { createAdminRouter, createAdminApiRouter } from './routes/admin.routes.js';

/**
 * Builds the Express app. Takes `prisma` as a parameter (rather than
 * importing a singleton) so tests can inject a mocked/test client without
 * needing a real database connection.
 */
export function createApp(prisma: PrismaClient) {
  const app = express();

  // Never trust X-Forwarded-For from a direct client: it would let someone
  // forge req.ip and bypass IP-based rate limits. Enable this only when the
  // API is deployed behind one known reverse-proxy hop.
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows admin dashboard CDN scripts and public invoice QR renders
      crossOriginEmbedderPolicy: false,
    })
  ); // sets baseline security headers (HSTS, X-Content-Type-Options, etc.) per spec section 11
  const allowedOriginsList = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, native callers, server-to-server with no origin
        if (!origin) return callback(null, true);

        // In development or if explicitly listed, allow the origin
        if (
          process.env.NODE_ENV !== 'production' ||
          allowedOriginsList.length === 0 ||
          allowedOriginsList.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  app.use('/v1/auth', createAuthRouter(prisma));
  app.use('/v1/clients', createClientsRouter(prisma));
  app.use('/v1/invoices', createInvoicesRouter(prisma));
  // Public invoice endpoints are accessible by anyone worldwide
  app.use('/v1/public', cors({ origin: true, credentials: true }), createPublicRouter(prisma));
  app.use('/v1/me', createMeRouter(prisma));
  app.use('/v1/dashboard', createDashboardRouter(prisma));
  app.use('/v1/notifications', createNotificationRouter(prisma));
  app.use('/admin', createAdminRouter(prisma));
  app.use('/v1/admin', createAdminApiRouter(prisma));

  // 404 fallback for anything unmatched
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Last-resort error handler — never leak stack traces or internals to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}
