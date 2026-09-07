import type { PrismaClient, PlanConfig } from '@prisma/client';

export interface UpdatePlanConfigInput {
  freeInvoiceLimit?: number;
  freeMaxInvoiceEdits?: number;
  referralRewardMonths?: number;
  proMonthlyPricePaise?: number;
  proAnnualPricePaise?: number;
  noticeBanner?: string | null;
  minAppVersion?: string | null;
}

let cachedConfig: PlanConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000;

/**
 * Retrieves the global plan configuration, creating defaults if not yet seeded.
 * Caches in memory for 15s to minimize database roundtrips on hot invoice creation paths.
 */
export async function getPlanConfig(prisma: PrismaClient): Promise<PlanConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (!prisma?.planConfig?.findUnique) {
    return {
      id: 'default',
      freeInvoiceLimit: 3,
      freeMaxInvoiceEdits: 1,
      referralRewardMonths: 1,
      proMonthlyPricePaise: 49900,
      proAnnualPricePaise: 399900,
      noticeBanner: null,
      minAppVersion: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  let config = await prisma.planConfig.findUnique({
    where: { id: 'default' },
  });

  if (!config) {
    config = await prisma.planConfig.create({
      data: {
        id: 'default',
        freeInvoiceLimit: 3,
        freeMaxInvoiceEdits: 1,
        referralRewardMonths: 1,
        proMonthlyPricePaise: 49900,
        proAnnualPricePaise: 399900,
      },
    });
  }

  cachedConfig = config;
  lastFetchTime = now;
  return config;
}

/**
 * Updates plan settings dynamically from the Admin Panel.
 * Immediately invalidates local cache.
 */
export async function updatePlanConfig(
  prisma: PrismaClient,
  input: UpdatePlanConfigInput
): Promise<PlanConfig> {
  const config = await prisma.planConfig.upsert({
    where: { id: 'default' },
    update: {
      ...(input.freeInvoiceLimit !== undefined ? { freeInvoiceLimit: input.freeInvoiceLimit } : {}),
      ...(input.freeMaxInvoiceEdits !== undefined ? { freeMaxInvoiceEdits: input.freeMaxInvoiceEdits } : {}),
      ...(input.referralRewardMonths !== undefined ? { referralRewardMonths: input.referralRewardMonths } : {}),
      ...(input.proMonthlyPricePaise !== undefined ? { proMonthlyPricePaise: input.proMonthlyPricePaise } : {}),
      ...(input.proAnnualPricePaise !== undefined ? { proAnnualPricePaise: input.proAnnualPricePaise } : {}),
      ...(input.noticeBanner !== undefined ? { noticeBanner: input.noticeBanner } : {}),
      ...(input.minAppVersion !== undefined ? { minAppVersion: input.minAppVersion } : {}),
    },
    create: {
      id: 'default',
      freeInvoiceLimit: input.freeInvoiceLimit ?? 3,
      freeMaxInvoiceEdits: input.freeMaxInvoiceEdits ?? 1,
      referralRewardMonths: input.referralRewardMonths ?? 1,
      proMonthlyPricePaise: input.proMonthlyPricePaise ?? 49900,
      proAnnualPricePaise: input.proAnnualPricePaise ?? 399900,
      noticeBanner: input.noticeBanner ?? null,
      minAppVersion: input.minAppVersion ?? null,
    },
  });

  cachedConfig = config;
  lastFetchTime = Date.now();
  return config;
}