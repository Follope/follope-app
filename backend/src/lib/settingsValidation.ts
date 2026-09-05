import { z } from 'zod';

export const businessSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().url().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(1000).optional(),
  gstin: z.string().trim().max(20).optional(), // deliberately not required — spec 16
  pan: z.string().trim().max(20).optional(), // deliberately not required
  website: z.string().trim().url().optional().or(z.literal('')),
  upiId: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\w.\-]+@[\w.\-]+$/, 'Enter a valid UPI ID, e.g. name@bank')
    .optional()
    .or(z.literal('')),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/i, 'Prefix should be letters/numbers only')
    .optional(),
  defaultDuePeriodDays: z.number().int().min(0).max(365).optional(),
  defaultTaxRateBps: z.number().int().min(0).max(10000).optional(),
  defaultInvoiceNotes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const profileSchema = z.object({
  role: z.enum(['developer', 'designer', 'video_editor', 'writer', 'marketer', 'consultant', 'student_freelancer', 'other']).optional(),
  phone: z.string().trim().max(30).optional(),
  preferredPaymentMethod: z.enum(['upi', 'bank_transfer', 'cash', 'other']).optional(),
});
