import { z } from 'zod';

// These mirror backend/src/lib/validation.ts field-for-field. Keeping them
// hand-synced (rather than sharing a package) since mobile and backend are
// separate deploys here — if you move to a monorepo, extract these into a
// shared package instead and import in both places.

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const sendOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
  name: z.string().trim().max(120).optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const registerSendOtpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address').max(255),
});
export type RegisterSendOtpInput = z.infer<typeof registerSendOtpSchema>;

export const registerVerifyOtpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
});
export type RegisterVerifyOtpInput = z.infer<typeof registerVerifyOtpSchema>;

export const forgotPasswordSendOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});
export type ForgotPasswordSendOtpInput = z.infer<typeof forgotPasswordSendOtpSchema>;

export const forgotPasswordVerifyOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type ForgotPasswordVerifyOtpInput = z.infer<typeof forgotPasswordVerifyOtpSchema>;

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(200),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  billingAddress: z.string().trim().max(1000).optional(),
  gstin: z.string().trim().max(20).optional(),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPricePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().optional(),
  taxRateBps: z.number().int().nonnegative().max(10000).optional(),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Select a client'),
  dueDate: z.string(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordPaymentSchema = z.object({
  amountPaise: z.number().int().positive('Enter a valid amount'),
  method: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER']),
  paidAt: z.string(),
  referenceId: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.method === 'UPI' && !value.referenceId?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['referenceId'], message: 'Enter the UPI reference ID to reconcile this payment' });
  }
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const businessSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(1000).optional(),
  gstin: z.string().trim().max(20).optional(),
  pan: z.string().trim().max(20).optional(),
  website: z.string().trim().url().optional().or(z.literal('')),
  upiId: z
    .string()
    .trim()
    .regex(/^[\w.\-]+@[\w.\-]+$/, 'Enter a valid UPI ID, e.g. name@bank')
    .optional()
    .or(z.literal('')),
  invoicePrefix: z.string().trim().min(1).max(10).optional(),
  defaultDuePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  defaultTaxRateBps: z.coerce.number().int().min(0).max(10000).optional(),
  defaultInvoiceNotes: z.string().trim().max(2000).optional(),
});
export type BusinessInput = z.infer<typeof businessSchema>;

// Rupees are what the user types; paise are what the API/calculator use.
// Keep the conversion in exactly one place so it can't drift.
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export function paiseToRupees(paise: number): number {
  return paise / 100;
}
export function formatRupees(paise: number): string {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
