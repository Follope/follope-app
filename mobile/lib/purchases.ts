import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import Constants from 'expo-constants';

export const ENTITLEMENT_ID = 'pro';

// Product IDs to be registered in Google Play Console
export const GOOGLE_PLAY_PRODUCT_IDS = {
  PRO_MONTHLY: 'follope_pro_monthly',
  PRO_ANNUAL: 'follope_pro_annual',
  LIFETIME: 'follope_lifetime',
} as const;

let isInitialized = false;

/**
 * Initializes RevenueCat SDK with the platform-specific API key.
 * Can be passed directly or configured via app.json (extra.revenueCatGoogleApiKey).
 */
export async function initializePurchases(userId?: string): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  const apiKey =
    Constants.expoConfig?.extra?.revenueCatGoogleApiKey ||
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ||
    'goog_mock_key_placeholder';

  try {
    if (!isInitialized) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      } else {
        await Purchases.setLogLevel(LOG_LEVEL.INFO);
      }

      await Purchases.configure({
        apiKey,
        appUserID: userId || undefined,
      });

      isInitialized = true;
    } else if (userId) {
      const current = await Purchases.getAppUserID();
      if (current !== userId) {
        await Purchases.logIn(userId);
      }
    }
    return true;
  } catch (err) {
    console.warn('[Purchases] RevenueCat initialization notice:', err);
    return false;
  }
}

/**
 * Retrieves available offerings and subscription packages from Google Play.
 */
export async function getSubscriptionOfferings(): Promise<PurchasesOffering | null> {
  try {
    if (!isInitialized) {
      await initializePurchases();
    }
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (err) {
    console.warn('[Purchases] Could not fetch offerings:', err);
    return null;
  }
}

/**
 * Purchases a package through Google Play Billing.
 */
export async function purchaseSubscriptionPackage(
  pkg: PurchasesPackage
): Promise<{ customerInfo: CustomerInfo | null; userCancelled: boolean }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, userCancelled: false };
  } catch (err: any) {
    if (err.userCancelled) {
      return { customerInfo: null, userCancelled: true };
    }
    throw err;
  }
}

/**
 * Restores previous purchases made by the user's Google Play account.
 * (Required by Google Play & Apple App Store review policies)
 */
export async function restoreUserPurchases(): Promise<CustomerInfo | null> {
  try {
    if (!isInitialized) {
      await initializePurchases();
    }
    return await Purchases.restorePurchases();
  } catch (err) {
    console.warn('[Purchases] Failed to restore purchases:', err);
    throw err;
  }
}

/**
 * Checks if the user has an active Pro entitlement in their CustomerInfo.
 */
export function hasActiveProEntitlement(customerInfo?: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}
