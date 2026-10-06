import Purchases, {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import type { Plan, PlanPeriod, PremiumDetails, PurchaseResult, RestoreResult } from './payments.ts';

// The only file that imports the RevenueCat SDK. It is loaded with import()
// from payments.ts, and only when payments are on and a real key exists.

const periods: Partial<Record<PACKAGE_TYPE, PlanPeriod>> = {
  [PACKAGE_TYPE.MONTHLY]: 'month',
  [PACKAGE_TYPE.ANNUAL]: 'year',
  [PACKAGE_TYPE.LIFETIME]: 'lifetime',
};
const order: PlanPeriod[] = ['month', 'year', 'lifetime'];

let configuredKey: string | undefined;
let listed = new Map<string, PurchasesPackage>();

export function configure(apiKey: string) {
  if (configuredKey === apiKey) {
    return;
  }
  Purchases.configure({ apiKey });
  configuredKey = apiKey;
}

function details(info: CustomerInfo, entitlement: string): PremiumDetails | null {
  const active = info.entitlements.active[entitlement];
  if (active === undefined) {
    return null;
  }
  return {
    expires: active.expirationDate,
    renews: active.willRenew,
    billingIssue: active.billingIssueDetectedAt !== null,
  };
}

export async function entitlementDetails(entitlement: string): Promise<PremiumDetails | null> {
  return details(await Purchases.getCustomerInfo(), entitlement);
}

export async function managementUrl(): Promise<string | null> {
  return (await Purchases.getCustomerInfo()).managementURL;
}

// A package is listed only when its billing period can be stated on the paywall.
export async function plans(): Promise<Plan[]> {
  const offerings = await Purchases.getOfferings();
  const found = new Map<PlanPeriod, PurchasesPackage>();
  for (const item of offerings.current?.availablePackages ?? []) {
    const period = periods[item.packageType];
    if (period !== undefined && !found.has(period)) {
      found.set(period, item);
    }
  }
  listed = new Map();
  const result: Plan[] = [];
  for (const period of order) {
    const item = found.get(period);
    if (item) {
      listed.set(item.identifier, item);
      result.push({ id: item.identifier, period, price: item.product.priceString });
    }
  }
  return result;
}

export async function purchase(planId: string): Promise<PurchaseResult> {
  const item = listed.get(planId);
  if (!item) {
    return 'failed';
  }
  try {
    await Purchases.purchasePackage(item);
    return 'purchased';
  } catch (error) {
    return errorCode(error) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ? 'cancelled'
      : errorCode(error) === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR
        ? 'pending'
        : 'failed';
  }
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

export async function restore(entitlement: string): Promise<RestoreResult> {
  const info = await Purchases.restorePurchases();
  const entitlements = Object.keys(info.entitlements.all);
  if (details(info, entitlement) !== null) {
    return { outcome: 'restored', entitlements };
  }
  return { outcome: info.allPurchasedProductIdentifiers.length > 0 ? 'notPremium' : 'nothing', entitlements };
}

export function onEntitlementChange(
  entitlement: string,
  listener: (details: PremiumDetails | null) => void,
): () => void {
  const onUpdate = (info: CustomerInfo) => listener(details(info, entitlement));
  Purchases.addCustomerInfoUpdateListener(onUpdate);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(onUpdate);
  };
}
