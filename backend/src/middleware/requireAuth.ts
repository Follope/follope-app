import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/auth.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    // Covers expired, malformed, and tampered tokens alike — never
    // distinguish these to the client, and never leak the JWT error detail.
    return res.status(401).json({
      error: { code: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' },
    });
  }
}
