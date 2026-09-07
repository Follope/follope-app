import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const sendOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  name: z.string().trim().max(120).optional(),
});

export const registerSendOtpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(255),
});

export const registerVerifyOtpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  code: z.string().trim().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const forgotPasswordSendOtpSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
});

export const forgotPasswordVerifyOtpSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  code: z.string().trim().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(200),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Valid email is required').max(255).optional().or(z.literal('')),
  phone: z.string().trim().min(10, 'Phone number must be at least 10 digits for WhatsApp').max(30),
  billingAddress: z.string().trim().max(1000).optional(),
  gstin: z.string().trim().max(20).optional(),
});

export const clientUpdateSchema = clientSchema.partial();

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().optional(),
  taxRateBps: z.number().int().nonnegative().max(10000).optional(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  dueDate: z.string().datetime().or(z.string().date()),
  items: z.array(invoiceItemSchema).min(1, 'Invoice must have at least one item'),
  notes: z.string().trim().max(2000).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.extend({
  reason: z.string().trim().max(500).optional(),
});

export const shareInvoiceSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const recordPaymentSchema = z.object({
  amountPaise: z.number().int().positive(),
  method: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER']),
  paidAt: z.string().datetime().or(z.string().date()),
  referenceId: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.method === 'UPI' && !value.referenceId?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['referenceId'], message: 'UPI reference ID is required for reconciliation' });
  }
});

// Business/profile settings schemas live in settingsValidation.ts, alongside
// businessService.ts/createProfileService — kept separate since they're a
// distinct settings domain from auth/clients/invoices above.
