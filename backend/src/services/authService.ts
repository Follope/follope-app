import type { PrismaClient } from '@prisma/client';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generatePasswordResetToken,
  hashPasswordResetToken,
  generateOtpCode,
  hashOtpCode,
  safeEqual,
} from '../lib/auth.js';
import { createEmailService, type EmailService } from './emailService.js';

export class AuthError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
  }
}

export function createAuthService(prisma: PrismaClient, emailService: EmailService = createEmailService()) {
  return {
    async register(input: { name: string; email: string; password: string }, ctx: { userAgent?: string; ip?: string }) {
      const email = input.email.trim().toLowerCase();

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Deliberately vague — do not reveal whether the email is registered.
        throw new AuthError('Unable to create account with these details', 'REGISTRATION_FAILED');
      }

      const passwordHash = await hashPassword(input.password);
      const user = await prisma.user.create({
        data: { name: input.name.trim(), email, passwordHash },
      });

      return issueSession(prisma, user.id, ctx);
    },

    async login(input: { email: string; password: string }, ctx: { userAgent?: string; ip?: string }) {
      const email = input.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      // Always run a bcrypt comparison even if user is missing, so response
      // timing doesn't reveal whether the email exists.
      const passwordHash = user?.passwordHash ?? '$2a$12$invalidsaltinvalidsaltinvalidsalthashxxxxxxxxxxxxxxxx';
      const valid = await verifyPassword(input.password, passwordHash);

      if (!user || !user.passwordHash || !valid) {
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'login', metadata: { ip: ctx.ip } },
      });

      return issueSession(prisma, user.id, ctx);
    },

    async refresh(refreshToken: string, ctx: { userAgent?: string; ip?: string }) {
      const hash = hashRefreshToken(refreshToken);
      const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });

      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        throw new AuthError('Session expired or invalid. Please sign in again.', 'SESSION_INVALID');
      }

      // Rotate: revoke the old session, issue a new one. Prevents refresh
      // token replay — if a stolen token is used after rotation, the
      // legitimate rotated session and the attacker's stale one diverge,
      // which is a signal you could alert on (not implemented here).
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

      return issueSession(prisma, session.userId, ctx);
    },

    async logout(refreshToken: string) {
      const hash = hashRefreshToken(refreshToken);
      await prisma.session.updateMany({
        where: { refreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async logoutAllDevices(userId: string) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async listActiveSessions(userId: string) {
      return prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    /** Revokes a single session by id, scoped to the requesting user so no one can revoke someone else's session by guessing an id. */
    async revokeSession(userId: string, sessionId: string) {
      const result = await prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count > 0;
    },

    /**
     * Changes the user's password after verifying their current one, then
     * revokes every existing session (including the one making this
     * request) — the mobile client re-authenticates by discarding its
     * local session and routing to login, same as any other "logged out
     * elsewhere" case.
     */
    async changePassword(userId: string, currentPassword: string, newPassword: string) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      if (!user.passwordHash) {
        throw new AuthError('This account uses Google sign-in and has no password to change', 'NO_PASSWORD_SET');
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        throw new AuthError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
      }

      const newHash = await hashPassword(newPassword);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
      await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId, action: 'password_changed' } });
    },

    async requestPasswordReset(emailInput: string, appBaseUrl = process.env.PUBLIC_APP_URL ?? 'https://follope.com') {
      const email = emailInput.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const { token, hash, expiresAt } = generatePasswordResetToken();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetTokenHash: hash,
            passwordResetExpiresAt: expiresAt,
          },
        });

        const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
        await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
        await prisma.auditLog.create({
          data: { userId: user.id, action: 'password_reset_requested' },
        });
      }

      // Vague response prevents user enumeration
      return { success: true };
    },

    async resetPassword(token: string, newPassword: string) {
      if (!token || !newPassword || newPassword.length < 8) {
        throw new AuthError('Password must be at least 8 characters', 'VALIDATION_ERROR');
      }

      const hash = hashPasswordResetToken(token);
      const user = await prisma.user.findFirst({
        where: {
          passwordResetTokenHash: hash,
          passwordResetExpiresAt: { gt: new Date() },
        },
      });

      if (!user) {
        throw new AuthError('Reset link is invalid or has expired. Please request a new one.', 'INVALID_RESET_TOKEN');
      }

      const newHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });

      // Revoke all sessions on password reset
      await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'password_reset_completed' },
      });

      return { success: true };
    },

    async sendOtp(emailInput: string) {
      const email = emailInput.trim().toLowerCase();

      // Check if an OTP was sent in the last 60 seconds to prevent abuse
      const recentOtp = await prisma.otp.findFirst({
        where: {
          email,
          createdAt: { gt: new Date(Date.now() - 60_000) },
        },
      });

      if (recentOtp) {
        throw new AuthError('Please wait 60 seconds before requesting another code', 'OTP_RATE_LIMITED');
      }

      const { code, hash, expiresAt } = generateOtpCode();
      await prisma.otp.create({
        data: {
          email,
          codeHash: hash,
          expiresAt,
        },
      });

      await emailService.sendOtpEmail(email, code);

      return {
        success: true,
        message: 'Verification code sent to your email',
      };
    },

    async verifyOtp(
      input: { email: string; code: string; name?: string },
      ctx: { userAgent?: string; ip?: string }
    ) {
      const email = input.email.trim().toLowerCase();
      const code = input.code.trim();

      const otp = await prisma.otp.findFirst({
        where: {
          email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otp || otp.attempts >= 5) {
        throw new AuthError('Invalid or expired verification code', 'INVALID_OTP');
      }

      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      const inputHash = hashOtpCode(code);
      if (!safeEqual(otp.codeHash, inputHash)) {
        throw new AuthError('Invalid verification code', 'INVALID_OTP');
      }

      // Mark OTP as used
      await prisma.otp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const name = input.name?.trim() || email.split('@')[0] || 'Freelancer';
        user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash: null,
          },
        });
        await prisma.auditLog.create({
          data: { userId: user.id, action: 'signup_otp', metadata: { ip: ctx.ip } },
        });
      } else {
        await prisma.auditLog.create({
          data: { userId: user.id, action: 'login_otp', metadata: { ip: ctx.ip } },
        });
      }

      return issueSession(prisma, user.id, ctx);
    },

    async sendRegistrationOtp(input: { name: string; email: string }) {
      const email = input.email.trim().toLowerCase();

      // Ensure user doesn't already exist
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AuthError('An account with this email already exists. Please log in.', 'EMAIL_EXISTS');
      }

      // Check 60s cooldown
      const recentOtp = await prisma.otp.findFirst({
        where: {
          email,
          createdAt: { gt: new Date(Date.now() - 60_000) },
        },
      });
      if (recentOtp) {
        throw new AuthError('Please wait 60 seconds before requesting another code', 'OTP_RATE_LIMITED');
      }

      const { code, hash, expiresAt } = generateOtpCode();
      await prisma.otp.create({
        data: {
          email,
          codeHash: hash,
          expiresAt,
        },
      });

      await emailService.sendOtpEmail(email, code);

      return {
        success: true,
        message: 'Verification code sent to your email',
      };
    },

    async verifyRegistrationOtp(
      input: { name: string; email: string; password: string; code: string },
      ctx: { userAgent?: string; ip?: string }
    ) {
      const email = input.email.trim().toLowerCase();
      const code = input.code.trim();

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AuthError('An account with this email already exists.', 'EMAIL_EXISTS');
      }

      const otp = await prisma.otp.findFirst({
        where: {
          email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otp || otp.attempts >= 5) {
        throw new AuthError('Invalid or expired verification code', 'INVALID_OTP');
      }

      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      const inputHash = hashOtpCode(code);
      if (!safeEqual(otp.codeHash, inputHash)) {
        throw new AuthError('Invalid verification code', 'INVALID_OTP');
      }

      await prisma.otp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      const passwordHash = await hashPassword(input.password);
      const user = await prisma.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
        },
      });

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'signup_verified', metadata: { ip: ctx.ip } },
      });

      // Dispatched welcome email
      emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
        console.error('[authService] Failed to send welcome email:', err);
      });

      return issueSession(prisma, user.id, ctx);
    },

    async sendForgotPasswordOtp(emailInput: string) {
      const email = emailInput.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const recentOtp = await prisma.otp.findFirst({
          where: {
            email,
            createdAt: { gt: new Date(Date.now() - 60_000) },
          },
        });

        if (recentOtp) {
          throw new AuthError('Please wait 60 seconds before requesting another code', 'OTP_RATE_LIMITED');
        }

        const { code, hash, expiresAt } = generateOtpCode();
        await prisma.otp.create({
          data: {
            email,
            codeHash: hash,
            expiresAt,
          },
        });

        await emailService.sendOtpEmail(email, code);
        await prisma.auditLog.create({
          data: { userId: user.id, action: 'forgot_password_otp_requested' },
        });
      }

      // Always return vague success message to prevent user enumeration
      return {
        success: true,
        message: 'If an account exists for this email, a 6-digit verification code has been sent.',
      };
    },

    async verifyForgotPasswordOtp(input: { email: string; code: string; newPassword: string }) {
      const email = input.email.trim().toLowerCase();
      const code = input.code.trim();

      const otp = await prisma.otp.findFirst({
        where: {
          email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otp || otp.attempts >= 5) {
        throw new AuthError('Invalid or expired verification code', 'INVALID_OTP');
      }

      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      const inputHash = hashOtpCode(code);
      if (!safeEqual(otp.codeHash, inputHash)) {
        throw new AuthError('Invalid verification code', 'INVALID_OTP');
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AuthError('Unable to reset password for this account', 'INVALID_RESET');
      }

      await prisma.otp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      const newHash = await hashPassword(input.newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Revoke all existing sessions
      await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'forgot_password_otp_completed' },
      });

      return {
        success: true,
        message: 'Your password has been reset successfully. Please log in with your new password.',
      };
    },
  };
}

async function issueSession(
  prisma: PrismaClient,
  userId: string,
  ctx: { userAgent?: string; ip?: string }
) {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hash,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ip,
      expiresAt,
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  return { user, accessToken, refreshToken };
}
