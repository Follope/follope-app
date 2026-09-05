import { describe, it, expect, beforeAll } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  safeEqual,
} from '../auth.js';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-xxxx';
});

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});

describe('access tokens', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signAccessToken('user_123');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user_123');
    expect(payload.type).toBe('access');
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken('user_123');
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('throws if AUTH_SECRET is too short or missing', () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'short';
    expect(() => signAccessToken('user_123')).toThrow();
    process.env.AUTH_SECRET = original;
  });
});

describe('refresh tokens', () => {
  it('generates a token whose stored hash matches re-hashing the same token', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('generates a future expiry', () => {
    const { expiresAt } = generateRefreshToken();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('generates unique tokens on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different-length strings without throwing', () => {
    expect(safeEqual('short', 'a-much-longer-string')).toBe(false);
  });
});
