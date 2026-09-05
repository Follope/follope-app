import { randomBytes, randomInt, createHash, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET env var must be set and at least 32 chars');
  }
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AccessTokenPayload {
  sub: string; // userId
  type: 'access';
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: 'access' };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
  if (decoded.type !== 'access') {
    throw new Error('Not an access token');
  }
  return decoded;
}

/**
 * Refresh tokens are opaque random strings, never JWTs. We store only a
 * SHA-256 hash of the token in the DB (Session.refreshTokenHash), so a
 * database read/leak alone can't be used to authenticate as the user.
 */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(48).toString('base64url');
  const hash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePasswordResetToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, hash, expiresAt };
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison for anything derived from a secret token. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Generates a 6-digit numeric OTP with 10-minute expiry and SHA-256 hash.
 */
export function generateOtpCode(): { code: string; hash: string; expiresAt: Date } {
  const code = randomInt(100000, 1000000).toString();
  const hash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, hash, expiresAt };
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

