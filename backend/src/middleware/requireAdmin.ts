import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { verifyAccessToken, verifyAdminToken } from '../lib/auth.js';

export interface AdminRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export function createRequireAdmin(prisma: PrismaClient) {
  return async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    // Admin APIs accept only short-lived admin sessions or an authenticated
    // ADMIN user. The long-lived master secret is never accepted as an API
    // credential and is never allowed in query strings.
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length);

      try {
        verifyAdminToken(token);
        req.isAdmin = true;
        return next();
      } catch {
        // It may instead be a normal user access token for an ADMIN account.
      }

      try {
        const payload = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, isBanned: true },
        });

        if (user && !user.isBanned && user.role === 'ADMIN') {
          req.userId = user.id;
          req.isAdmin = true;
          return next();
        }
      } catch {
        // Fall through to 401
      }
    }

    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Admin authorization required.' },
    });
  };
}
