import type { PrismaClient } from '@prisma/client';

export interface BusinessInput {
  businessName?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  website?: string | null;
  upiId?: string | null;
  invoicePrefix?: string;
  defaultDuePeriodDays?: number;
  defaultTaxRateBps?: number;
  defaultInvoiceNotes?: string | null;
}

export interface ProfileInput {
  role?: string;
  phone?: string;
  preferredPaymentMethod?: string;
}

const UPI_ID_REGEX = /^[\w.\-]+@[\w.\-]+$/;

export function isValidUpiId(upiId: string): boolean {
  return UPI_ID_REGEX.test(upiId);
}

export function createBusinessService(prisma: PrismaClient) {
  return {
    async get(userId: string) {
      return prisma.business.findUnique({ where: { userId } });
    },

    /**
     * Business is a 1:1 settings resource per user — "upsert" semantics,
     * not create-only, since the row may already exist from onboarding.
     * GSTIN/PAN stay optional here regardless of caller input, per spec:
     * many freelancers aren't GST-registered and must never be blocked.
     */
    async upsert(userId: string, input: BusinessInput) {
      if (input.upiId && !isValidUpiId(input.upiId)) {
        throw new Error('Invalid UPI ID format');
      }

      // Empty strings come from optional-or-empty-string form fields and
      // mean "field left blank," not "clear this value" — drop them so an
      // untouched field never overwrites a previously saved value.
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, value === '' ? null : value])
      ) as BusinessInput;

      return prisma.business.upsert({
        where: { userId },
        create: { userId, ...cleaned },
        update: cleaned,
      });
    },
  };
}

export function createProfileService(prisma: PrismaClient) {
  return {
    async get(userId: string) {
      return prisma.profile.findUnique({ where: { userId } });
    },

    async upsert(userId: string, input: ProfileInput) {
      return prisma.profile.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    },

    async markOnboarded(userId: string) {
      return prisma.profile.upsert({
        where: { userId },
        create: { userId, onboardedAt: new Date() },
        update: { onboardedAt: new Date() },
      });
    },
  };
}
