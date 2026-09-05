import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createAuthService, AuthError } from '../services/authService.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
  registerSendOtpSchema,
  registerVerifyOtpSchema,
  forgotPasswordSendOtpSchema,
  forgotPasswordVerifyOtpSchema,
} from '../lib/validation.js';
import { loginRateLimit, loginRateLimitByEmail, registerRateLimit, rateLimit } from '../middleware/rateLimit.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

export function createAuthRouter(prisma: PrismaClient) {
  const router = Router();
  const authService = createAuthService(prisma);
  // Separate, more generous limit than login — refresh fires automatically
  // on token expiry during normal use, but still needs a ceiling since a
  // stolen refresh token could otherwise be hammered indefinitely trying
  // to race the rotation logic or just to DoS the endpoint.
  const refreshRateLimit = rateLimit({ windowMs: 60_000, max: 20 });

  router.post('/register', registerRateLimit, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }

    try {
      const result = await authService.register(parsed.data, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('register error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/login', loginRateLimit, loginRateLimitByEmail, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email or password' } });
    }

    try {
      const result = await authService.login(parsed.data, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(401).json({ error: { code: err.code, message: err.message } });
      }
      console.error('login error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/refresh', refreshRateLimit, async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    }

    try {
      const result = await authService.refresh(parsed.data.refreshToken, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(401).json({ error: { code: err.code, message: err.message } });
      }
      console.error('refresh error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/logout', async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ data: { success: true } }); // logout is idempotent either way
    }
    await authService.logout(parsed.data.refreshToken);
    return res.json({ data: { success: true } });
  });

  router.post('/logout-all', requireAuth, async (req: AuthedRequest, res) => {
    await authService.logoutAllDevices(req.userId!);
    return res.json({ data: { success: true } });
  });

  router.post('/forgot-password', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid email is required' } });
    }
    try {
      await authService.requestPasswordReset(parsed.data.email);
      return res.json({
        data: {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
      });
    } catch (err) {
      console.error('forgot-password error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/reset-password', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request' },
      });
    }
    try {
      await authService.resetPassword(parsed.data.token, parsed.data.password);
      return res.json({ data: { success: true, message: 'Password has been reset successfully.' } });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('reset-password error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/otp/send', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Valid email is required' },
      });
    }

    try {
      const result = await authService.sendOtp(parsed.data.email);
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('otp/send error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/otp/verify', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid code or email' },
      });
    }

    try {
      const result = await authService.verifyOtp(parsed.data, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(401).json({ error: { code: err.code, message: err.message } });
      }
      console.error('otp/verify error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  // -------------------------------------------------------------------------
  // Registration with OTP Verification
  // -------------------------------------------------------------------------
  router.post('/register/send-otp', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    const parsed = registerSendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }

    try {
      const result = await authService.sendRegistrationOtp(parsed.data);
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('register/send-otp error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/register/verify', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
    const parsed = registerVerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }

    try {
      const result = await authService.verifyRegistrationOtp(parsed.data, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('register/verify error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  // -------------------------------------------------------------------------
  // Forgot Password with OTP Verification
  // -------------------------------------------------------------------------
  router.post('/forgot-password/send-otp', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    const parsed = forgotPasswordSendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Valid email is required' },
      });
    }

    try {
      const result = await authService.sendForgotPasswordOtp(parsed.data.email);
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('forgot-password/send-otp error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  router.post('/forgot-password/verify-otp', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
    const parsed = forgotPasswordVerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }

    try {
      const result = await authService.verifyForgotPasswordOtp(parsed.data);
      return res.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      console.error('forgot-password/verify-otp error', err);
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
  });

  return router;
}
