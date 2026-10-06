import { useAppSettings, useText } from '@factory/app';
import { useRouter } from 'expo-router';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';

import { createPayments, premiumEntitlement, type Plan, type PremiumDetails, type PurchaseResult, type RestoreResult } from './payments.ts';
import { text } from './text/index.ts';

export type PremiumStatus = 'loading' | 'active' | 'inactive';

type PaymentsState = {
  available: boolean;
  status: PremiumStatus;
  details: PremiumDetails | null;
  identify: (appUserId: string) => Promise<void>;
  plans: () => Promise<Plan[]>;
  purchase: (plan: Plan) => Promise<PurchaseResult>;
  restore: () => Promise<RestoreResult>;
  manage: () => Promise<void>;
};

const PaymentsContext = createContext<PaymentsState | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const settings = useAppSettings();
  const [payments] = useState(() =>
    createPayments(settings, { platform: Platform.OS, development: __DEV__ }),
  );
  // undefined until the first answer; null when there is no premium.
  const [entitlement, setEntitlement] = useState<PremiumDetails | null | undefined>(
    payments.available ? undefined : null,
  );

  useEffect(() => {
    if (!payments.available) {
      return;
    }
    let current = true;
    const update = (details: PremiumDetails | null) => {
      if (current) {
        setEntitlement(details);
      }
    };
    const stop = payments.onEntitlementChange(update);
    // A failed refresh keeps what is known; RevenueCat answers from its own cache when offline.
    payments.entitlement().then(update, () => current && setEntitlement((known) => known ?? null));
    return () => {
      current = false;
      stop();
    };
  }, [payments]);

  async function purchase(plan: Plan): Promise<PurchaseResult> {
    const result = await payments.purchase(plan).catch((): PurchaseResult => 'failed');
    if (result === 'purchased') {
      const details = await payments.entitlement().catch(() => undefined);
      if (details !== undefined) {
        setEntitlement(details);
      }
    }
    return result;
  }

  async function restore(): Promise<RestoreResult> {
    const result = await payments.restore();
    setEntitlement(result.outcome === 'restored' ? await payments.entitlement() : null);
    return result;
  }

  async function manage() {
    await Linking.openURL(await payments.managementUrl());
  }

  async function identify(appUserId: string) {
    await payments.identify(appUserId);
    setEntitlement(await payments.entitlement());
  }

  const status: PremiumStatus = entitlement === undefined ? 'loading' : entitlement === null ? 'inactive' : 'active';

  return (
    <PaymentsContext
      value={{ available: payments.available, status, details: entitlement ?? null, identify, plans: payments.plans, purchase, restore, manage }}
    >
      {children}
    </PaymentsContext>
  );
}

export function usePayments(): PaymentsState {
  const state = use(PaymentsContext);
  if (!state) {
    throw new Error('usePayments must be used inside PaymentsProvider');
  }
  return state;
}

// For feature screens: gate on `status`, and call `openPaywall` when a
// premium feature is opened. Nothing opens while payments are unavailable.
export function usePremium() {
  const { available, status, details, manage } = usePayments();
  const router = useRouter();

  return {
    available,
    status,
    details,
    manage,
    openPaywall() {
      if (available) {
        router.push('/paywall');
      }
    },
  };
}

type RestoreOutcome = 'restored' | 'notPremium' | 'nothing' | 'failed';

export function useRestore() {
  const { restore } = usePayments();
  const t = useText(text);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const [entitlements, setEntitlements] = useState<string[]>([]);

  async function run() {
    setBusy(true);
    setOutcome(null);
    const result = await restore().then(
      (found): { outcome: RestoreOutcome; entitlements: string[] } => found,
      () => ({ outcome: 'failed' as const, entitlements: [] }),
    );
    setOutcome(result.outcome);
    setEntitlements(result.entitlements);
    setBusy(false);
  }

  return {
    label: t('restore.action'),
    busy,
    message: outcome === null ? null : t(`restore.${outcome}`),
    // Development builds name the entitlements RevenueCat knows, to catch a wrong identifier.
    hint:
      __DEV__ && outcome === 'notPremium'
        ? t('restore.devHint', { found: entitlements.join(', ') || '-', needed: premiumEntitlement })
        : null,
    restore: () => void run(),
  };
}
