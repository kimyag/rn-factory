import Purchases, {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import type { Plan, PlanPeriod, PurchaseResult } from './payments.ts';

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

function isActive(info: CustomerInfo, entitlement: string): boolean {
  return info.entitlements.active[entitlement] !== undefined;
}

export async function entitlementActive(entitlement: string): Promise<boolean> {
  return isActive(await Purchases.getCustomerInfo(), entitlement);
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
    return isCancelled(error) ? 'cancelled' : 'failed';
  }
}

function isCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

export async function restore(entitlement: string): Promise<boolean> {
  return isActive(await Purchases.restorePurchases(), entitlement);
}

export function onEntitlementChange(entitlement: string, listener: (active: boolean) => void): () => void {
  const onUpdate = (info: CustomerInfo) => listener(isActive(info, entitlement));
  Purchases.addCustomerInfoUpdateListener(onUpdate);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(onUpdate);
  };
}
