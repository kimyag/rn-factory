import { isPlaceholder, type AppSettings } from '@factory/core';

export const premiumEntitlement = 'premium';

export type PlanPeriod = 'month' | 'year' | 'lifetime';
export type Plan = { id: string; period: PlanPeriod; price: string };
export type PurchaseResult = 'purchased' | 'pending' | 'cancelled' | 'failed';

// What the store told us about an active premium entitlement. `expires` is null for a
// one-time purchase.
export type PremiumDetails = { expires: string | null; renews: boolean; billingIssue: boolean };
// `notPremium`: the store account has purchases, but none gives the premium entitlement.
export type RestoreResult = { outcome: 'restored' | 'notPremium' | 'nothing'; entitlements: string[] };

export type PaymentsSettings = Pick<AppSettings, 'modules' | 'payments' | 'bundleIds'>;
export type PaymentsEnvironment = { platform: string; development: boolean };

export type PaymentsVendor = {
  configure: (apiKey: string) => void;
  identify: (appUserId: string) => Promise<void>;
  entitlementDetails: (entitlement: string) => Promise<PremiumDetails | null>;
  plans: () => Promise<Plan[]>;
  purchase: (planId: string) => Promise<PurchaseResult>;
  restore: (entitlement: string) => Promise<RestoreResult>;
  managementUrl: () => Promise<string | null>;
  onEntitlementChange: (
    entitlement: string,
    listener: (details: PremiumDetails | null) => void,
  ) => () => void;
};

export type SummaryKey = 'premium.lifetime' | 'premium.renews' | 'premium.ends' | 'premium.billingIssue';
export type SummaryLine = { key: SummaryKey; date: string | null };

// The lines Settings shows under "Premium is active".
export function premiumSummary(details: PremiumDetails): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (details.expires === null) {
    lines.push({ key: 'premium.lifetime', date: null });
  } else {
    lines.push({ key: details.renews ? 'premium.renews' : 'premium.ends', date: details.expires });
  }
  if (details.billingIssue) {
    lines.push({ key: 'premium.billingIssue', date: null });
  }
  return lines;
}

// Used when RevenueCat has no management link, e.g. the Test Store in development.
export function fallbackManagementUrl(settings: Pick<AppSettings, 'bundleIds'>, platform: string): string {
  return platform === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : `https://play.google.com/store/account/subscriptions?package=${settings.bundleIds.android}`;
}

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
    async identify(appUserId: string): Promise<void> {
      if (apiKey !== null) await (await ready(apiKey)).identify(appUserId);
    },
    async entitlement(): Promise<PremiumDetails | null> {
      if (apiKey === null) {
        return null;
      }
      return (await ready(apiKey)).entitlementDetails(premiumEntitlement);
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
    async restore(): Promise<RestoreResult> {
      if (apiKey === null) {
        return { outcome: 'nothing', entitlements: [] };
      }
      return (await ready(apiKey)).restore(premiumEntitlement);
    },
    async managementUrl(): Promise<string> {
      const link = apiKey === null ? null : await (await ready(apiKey)).managementUrl().catch(() => null);
      return link ?? fallbackManagementUrl(settings, environment.platform);
    },
    onEntitlementChange(listener: (details: PremiumDetails | null) => void): () => void {
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
