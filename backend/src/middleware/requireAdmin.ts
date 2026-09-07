import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { verifyAccessToken } from '../lib/auth.js';

export interface AdminRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export function createRequireAdmin(prisma: PrismaClient) {
  return async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    const adminSecret = process.env.ADMIN_SECRET || 'follope_superadmin_2026';

    // 1. Check custom header x-admin-key or query param (for direct browser downloads like CSV exports)
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    if (adminKey && typeof adminKey === 'string' && adminKey === adminSecret) {
      req.isAdmin = true;
      return next();
    }

    // 2. Check Authorization Bearer token
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length);

      // Direct admin key passed as Bearer token
      if (token === adminSecret) {
        req.isAdmin = true;
        return next();
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
