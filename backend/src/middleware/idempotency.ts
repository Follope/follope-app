import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './requireAuth.js';

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

const TTL_MS = 5 * 60_000; // 5 minutes, per API-DESIGN.md

/**
 * In-memory idempotency cache, scoped per-user so one user can't guess/reuse
 * another user's key to read their response. Same single-instance caveat as
 * rateLimit.ts — move to Redis (keyed the same way) for multi-instance
 * deployments.
 *
 * Usage: mount on a specific POST route (not globally — GET/PATCH/DELETE
 * don't need this), after requireAuth so req.userId is available.
 */
export function idempotency() {
  const store = new Map<string, CachedResponse>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) store.delete(key);
    }
  }, TTL_MS).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'];
    const userId = (req as AuthedRequest).userId;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !userId) {
      return next(); // no key supplied — proceed normally, nothing to dedupe
    }

    const cacheKey = `${userId}:${idempotencyKey}`;
    const cached = store.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.status(cached.status).json(cached.body);
    }

    // Intercept res.json to capture the response for replay, without
    // changing how the route handler itself calls res.status().json().
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful creates — never cache a validation/server
      // error under the key, so a genuine retry after a fixed input isn't
      // stuck replaying the old failure.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(cacheKey, { status: res.statusCode, body, expiresAt: Date.now() + TTL_MS });
      }
      return originalJson(body);
    };

    next();
  };
}
