import { isPlaceholder, type AppSettings } from '@factory/core';

export const premiumEntitlement = 'premium';

export type PlanPeriod = 'month' | 'year' | 'lifetime';
export type Plan = { id: string; period: PlanPeriod; price: string };
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

export type PaymentsSettings = Pick<AppSettings, 'modules' | 'payments'>;
export type PaymentsEnvironment = { platform: string; development: boolean };

export type PaymentsVendor = {
  configure: (apiKey: string) => void;
  entitlementActive: (entitlement: string) => Promise<boolean>;
  plans: () => Promise<Plan[]>;
  purchase: (planId: string) => Promise<PurchaseResult>;
  restore: (entitlement: string) => Promise<boolean>;
  onEntitlementChange: (entitlement: string, listener: (active: boolean) => void) => () => void;
};

// The Test Store key is for development builds only: the SDK crashes a release
// build on purpose when it is configured with one.
export function paymentsApiKey(
  settings: PaymentsSettings,
  { platform, development }: PaymentsEnvironment,
): string | null {
  if (!settings.modules.payments || (platform !== 'ios' && platform !== 'android')) {
    return null;
  }
  const { revenueCatIosApiKey, revenueCatAndroidApiKey, revenueCatTestStoreApiKey } = settings.payments;
  const storeKey = platform === 'ios' ? revenueCatIosApiKey : revenueCatAndroidApiKey;
  const key = development && !isPlaceholder(revenueCatTestStoreApiKey) ? revenueCatTestStoreApiKey : storeKey;
  return isPlaceholder(key) ? null : key;
}

export function createPayments(
  settings: PaymentsSettings,
  environment: PaymentsEnvironment,
  load: () => Promise<PaymentsVendor> = () => import('./vendor.ts'),
) {
  const apiKey = paymentsApiKey(settings, environment);
  let vendor: Promise<PaymentsVendor> | undefined;

  // The vendor is loaded and configured on first use, and never without a key.
  function ready(key: string): Promise<PaymentsVendor> {
    vendor ??= load().then((adapter) => {
      adapter.configure(key);
      return adapter;
    });
    return vendor;
  }

  return {
    available: apiKey !== null,
    async entitlement(): Promise<boolean> {
      if (apiKey === null) {
        return false;
      }
      return (await ready(apiKey)).entitlementActive(premiumEntitlement);
    },
    async plans(): Promise<Plan[]> {
      if (apiKey === null) {
        return [];
      }
      return (await ready(apiKey)).plans();
    },
    async purchase(plan: Plan): Promise<PurchaseResult> {
      if (apiKey === null) {
        return 'failed';
      }
      return (await ready(apiKey)).purchase(plan.id);
    },
    async restore(): Promise<boolean> {
      if (apiKey === null) {
        return false;
      }
      return (await ready(apiKey)).restore(premiumEntitlement);
    },
    onEntitlementChange(listener: (active: boolean) => void): () => void {
      if (apiKey === null) {
        return () => {};
      }
      let stopped = false;
      let stop: (() => void) | undefined;
      void ready(apiKey)
        .then((adapter) => {
          if (!stopped) {
            stop = adapter.onEntitlementChange(premiumEntitlement, listener);
          }
        })
        .catch(() => {});
      return () => {
        stopped = true;
        stop?.();
      };
    },
  };
}

export type Payments = ReturnType<typeof createPayments>;
