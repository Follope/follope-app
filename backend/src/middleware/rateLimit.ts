import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window rate limiter. Fine for a single-instance deployment;
 * swap the store for Redis (e.g. via a sliding-window script) once you run
 * more than one backend instance, since this state doesn't share across
 * processes.
 */
export function rateLimit(opts: { windowMs: number; max: number; keyFn?: (req: Request) => string }) {
  const store = new Map<string, Bucket>();

  // periodic cleanup so the map doesn't grow unbounded
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt < now) store.delete(key);
    }
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn ? opts.keyFn(req) : req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
      });
    }

    bucket.count += 1;
    next();
  };
}

// Preset limiters for sensitive routes, per spec section 51.
export const loginRateLimit = rateLimit({ windowMs: 60_000, max: 5 }); // 5/min per IP
export const loginRateLimitByEmail = rateLimit({
  windowMs: 60 * 60_000,
  max: 10, // 10/hr per email, independent of IP
  keyFn: (req) => `email:${(req.body?.email ?? 'unknown').toLowerCase()}`,
});
export const registerRateLimit = rateLimit({ windowMs: 60_000, max: 3 });
export const passwordResetRateLimit = rateLimit({ windowMs: 60_000, max: 3 });
export const publicInvoiceRateLimit = rateLimit({ windowMs: 60_000, max: 30 });
