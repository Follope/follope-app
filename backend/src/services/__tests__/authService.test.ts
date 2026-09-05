import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createAuthService, AuthError } from '../authService.js';
import type { EmailService } from '../emailService.js';
import { hashPassword } from '../../lib/auth.js';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-xxxx';
});

function mockPrisma(overrides: { passwordHash?: string | null } = {}) {
  const passwordHash = overrides.passwordHash;
  return {
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'user_1', email: 'test@example.com', name: 'Raj', passwordHash }),
      findUnique: vi.fn().mockResolvedValue({ id: 'user_1', email: 'test@example.com', name: 'Raj' }),
      create: vi.fn().mockResolvedValue({ id: 'user_new', email: 'new@example.com', name: 'New User' }),
      update: vi.fn().mockResolvedValue({}),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session_1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    otp: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'otp_1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function createMockEmailService(): EmailService {
  return {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendOtpEmail: vi.fn().mockResolvedValue(true),
    sendWelcomeEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
    sendInvoiceEmail: vi.fn().mockResolvedValue(true),
    sendPaymentReceiptEmail: vi.fn().mockResolvedValue(true),
    sendPaymentReminderEmail: vi.fn().mockResolvedValue(true),
  };
}

describe('authService.changePassword', () => {
  it('changes the password when the current password is correct', async () => {
    const currentHash = await hashPassword('old-password-123');
    const prisma = mockPrisma({ passwordHash: currentHash });
    const service = createAuthService(prisma);

    await service.changePassword('user_1', 'old-password-123', 'new-password-456');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { passwordHash: expect.any(String) },
    });
  });

  it('revokes all existing sessions after a successful password change', async () => {
    const currentHash = await hashPassword('old-password-123');
    const prisma = mockPrisma({ passwordHash: currentHash });
    const service = createAuthService(prisma);

    await service.changePassword('user_1', 'old-password-123', 'new-password-456');

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an incorrect current password without changing anything', async () => {
    const currentHash = await hashPassword('old-password-123');
    const prisma = mockPrisma({ passwordHash: currentHash });
    const service = createAuthService(prisma);

    await expect(service.changePassword('user_1', 'wrong-password', 'new-password-456')).rejects.toThrow(AuthError);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects changing a password for a Google-only account with no password set', async () => {
    const prisma = mockPrisma({ passwordHash: null });
    const service = createAuthService(prisma);

    await expect(service.changePassword('user_1', 'anything', 'new-password-456')).rejects.toThrow(AuthError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('authService.revokeSession', () => {
  it('revokes a session scoped to the requesting user and reports success', async () => {
    const prisma = mockPrisma();
    prisma.session.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = createAuthService(prisma);

    const result = await service.revokeSession('user_1', 'session_abc');

    expect(result).toBe(true);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session_abc', userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns false when the session does not belong to the requesting user (or does not exist)', async () => {
    const prisma = mockPrisma();
    prisma.session.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = createAuthService(prisma);

    const result = await service.revokeSession('user_1', 'someone_elses_session');

    expect(result).toBe(false);
  });
});

describe('authService.requestPasswordReset & resetPassword', () => {
  it('generates a reset token and sends an email if the user exists', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user_1',
      name: 'Raj',
      email: 'test@example.com',
    });
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.requestPasswordReset('test@example.com', 'https://follope.com');

    expect(result).toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        passwordResetTokenHash: expect.any(String),
        passwordResetExpiresAt: expect.any(Date),
      },
    });
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'test@example.com',
      'Raj',
      expect.stringContaining('https://follope.com/reset-password?token=')
    );
  });

  it('returns success without error even if the email does not exist (prevents user enumeration)', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.requestPasswordReset('nonexistent@example.com');

    expect(result).toEqual({ success: true });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets password and revokes sessions when a valid token is provided', async () => {
    const prisma = mockPrisma();
    prisma.user.findFirst = vi.fn().mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
    });

    const service = createAuthService(prisma);
    const result = await service.resetPassword('valid_token_123', 'new-super-secret-password');

    expect(result).toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        passwordHash: expect.any(String),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects resetPassword when the token is invalid or expired', async () => {
    const prisma = mockPrisma();
    prisma.user.findFirst = vi.fn().mockResolvedValue(null);

    const service = createAuthService(prisma);
    await expect(service.resetPassword('expired_or_invalid_token', 'new-password-123')).rejects.toThrow(AuthError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('authService OTP authentication', () => {
  it('sends an OTP code and saves hash to database', async () => {
    const prisma = mockPrisma();
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.sendOtp('test@example.com');

    expect(result.success).toBe(true);
    expect(prisma.otp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it('rate limits OTP requests within 60 seconds', async () => {
    const prisma = mockPrisma();
    prisma.otp.findFirst = vi.fn().mockResolvedValue({ id: 'recent_otp' });

    const service = createAuthService(prisma);
    await expect(service.sendOtp('test@example.com')).rejects.toThrow('Please wait 60 seconds');
    expect(prisma.otp.create).not.toHaveBeenCalled();
  });

  it('verifies valid OTP and logs in existing user', async () => {
    const { hashOtpCode } = await import('../../lib/auth.js');
    const validCode = '123456';
    const validHash = hashOtpCode(validCode);

    const prisma = mockPrisma();
    prisma.otp.findFirst = vi.fn().mockResolvedValue({
      id: 'otp_valid',
      email: 'test@example.com',
      codeHash: validHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
    });
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Raj',
    });

    const service = createAuthService(prisma);
    const result = await service.verifyOtp(
      { email: 'test@example.com', code: '123456' },
      { ip: '127.0.0.1', userAgent: 'test-agent' }
    );

    expect(result.user).toEqual({ id: 'user_1', email: 'test@example.com', name: 'Raj' });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(prisma.otp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp_valid' },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    );
  });

  it('verifies valid OTP and creates new user if non-existent (passwordless signup)', async () => {
    const { hashOtpCode } = await import('../../lib/auth.js');
    const validCode = '654321';
    const validHash = hashOtpCode(validCode);

    const prisma = mockPrisma();
    prisma.otp.findFirst = vi.fn().mockResolvedValue({
      id: 'otp_signup',
      email: 'brandnew@example.com',
      codeHash: validHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
    });
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user_new',
      email: 'brandnew@example.com',
      name: 'Brand New',
    });
    prisma.user.findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 'user_new',
      email: 'brandnew@example.com',
      name: 'Brand New',
    });

    const service = createAuthService(prisma);
    const result = await service.verifyOtp(
      { email: 'brandnew@example.com', code: '654321', name: 'Brand New' },
      { ip: '127.0.0.1' }
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'brandnew@example.com',
        name: 'Brand New',
        passwordHash: null,
      },
    });
    expect(result.user.email).toBe('brandnew@example.com');
  });

  it('rejects incorrect OTP code', async () => {
    const { hashOtpCode } = await import('../../lib/auth.js');
    const prisma = mockPrisma();
    prisma.otp.findFirst = vi.fn().mockResolvedValue({
      id: 'otp_1',
      email: 'test@example.com',
      codeHash: hashOtpCode('111111'),
      attempts: 0,
    });

    const service = createAuthService(prisma);
    await expect(
      service.verifyOtp({ email: 'test@example.com', code: '999999' }, {})
    ).rejects.toThrow('Invalid verification code');

    expect(prisma.otp.update).toHaveBeenCalledWith({
      where: { id: 'otp_1' },
      data: { attempts: { increment: 1 } },
    });
  });
});

describe('authService Registration OTP', () => {
  it('sends registration OTP if email is not registered', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.sendRegistrationOtp({ name: 'Vikram', email: 'vikram@example.com' });

    expect(result.success).toBe(true);
    expect(prisma.otp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'vikram@example.com' }),
      })
    );
    expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith('vikram@example.com', expect.any(String));
  });

  it('rejects registration OTP if email is already taken', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue({ id: 'existing_user' });

    const service = createAuthService(prisma);
    await expect(
      service.sendRegistrationOtp({ name: 'Existing', email: 'taken@example.com' })
    ).rejects.toThrow('An account with this email already exists');
  });

  it('verifies registration OTP, creates user with password hash, and sends welcome email', async () => {
    const { hashOtpCode } = await import('../../lib/auth.js');
    const validCode = '112233';

    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.otp.findFirst = vi.fn().mockResolvedValue({
      id: 'otp_reg',
      email: 'vikram@example.com',
      codeHash: hashOtpCode(validCode),
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
    });
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user_vikram',
      name: 'Vikram',
      email: 'vikram@example.com',
    });
    prisma.user.findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 'user_vikram',
      name: 'Vikram',
      email: 'vikram@example.com',
    });
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.verifyRegistrationOtp(
      { name: 'Vikram', email: 'vikram@example.com', password: 'securePassword123!', code: validCode },
      { ip: '127.0.0.1' }
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Vikram',
        email: 'vikram@example.com',
        passwordHash: expect.any(String),
      }),
    });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('vikram@example.com', 'Vikram');
  });
});

describe('authService Forgot Password OTP', () => {
  it('sends forgot password OTP when user exists', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue({ id: 'user_1', email: 'user@example.com' });
    const mockEmailService = createMockEmailService();

    const service = createAuthService(prisma, mockEmailService);
    const result = await service.sendForgotPasswordOtp('user@example.com');

    expect(result.success).toBe(true);
    expect(prisma.otp.create).toHaveBeenCalled();
    expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
  });

  it('verifies forgot password OTP and updates password hash', async () => {
    const { hashOtpCode } = await import('../../lib/auth.js');
    const validCode = '998877';

    const prisma = mockPrisma();
    prisma.otp.findFirst = vi.fn().mockResolvedValue({
      id: 'otp_fp',
      email: 'user@example.com',
      codeHash: hashOtpCode(validCode),
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
    });
    prisma.user.findUnique = vi.fn().mockResolvedValue({ id: 'user_1', email: 'user@example.com' });

    const service = createAuthService(prisma);
    const result = await service.verifyForgotPasswordOtp({
      email: 'user@example.com',
      code: validCode,
      newPassword: 'brandNewPassword123!',
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { passwordHash: expect.any(String) },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
