import { useAppSettings, useText } from '@factory/app';
import { useRouter } from 'expo-router';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { createPayments, type Plan, type PurchaseResult } from './payments.ts';
import { text } from './text/index.ts';

export type PremiumStatus = 'loading' | 'active' | 'inactive';

type PaymentsState = {
  available: boolean;
  status: PremiumStatus;
  plans: () => Promise<Plan[]>;
  purchase: (plan: Plan) => Promise<PurchaseResult>;
  restore: () => Promise<boolean>;
};

const PaymentsContext = createContext<PaymentsState | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const settings = useAppSettings();
  const [payments] = useState(() =>
    createPayments(settings, { platform: Platform.OS, development: __DEV__ }),
  );
  const [status, setStatus] = useState<PremiumStatus>(payments.available ? 'loading' : 'inactive');

  useEffect(() => {
    if (!payments.available) {
      return;
    }
    let current = true;
    const update = (active: boolean) => {
      if (current) {
        setStatus(active ? 'active' : 'inactive');
      }
    };
    const stop = payments.onEntitlementChange(update);
    payments.entitlement().then(update, () => update(false));
    return () => {
      current = false;
      stop();
    };
  }, [payments]);

  async function purchase(plan: Plan): Promise<PurchaseResult> {
    const result = await payments.purchase(plan).catch((): PurchaseResult => 'failed');
    if (result === 'purchased') {
      const active = await payments.entitlement().catch(() => null);
      if (active !== null) {
        setStatus(active ? 'active' : 'inactive');
      }
    }
    return result;
  }

  async function restore(): Promise<boolean> {
    const active = await payments.restore();
    setStatus(active ? 'active' : 'inactive');
    return active;
  }

  return (
    <PaymentsContext
      value={{ available: payments.available, status, plans: payments.plans, purchase, restore }}
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
  const { available, status } = usePayments();
  const router = useRouter();

  return {
    available,
    status,
    openPaywall() {
      if (available) {
        router.push('/paywall');
      }
    },
  };
}

type RestoreOutcome = 'restored' | 'nothing' | 'failed';

export function useRestore() {
  const { restore } = usePayments();
  const t = useText(text);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);

  async function run() {
    setBusy(true);
    setOutcome(null);
    const result = await restore().then(
      (active): RestoreOutcome => (active ? 'restored' : 'nothing'),
      (): RestoreOutcome => 'failed',
    );
    setOutcome(result);
    setBusy(false);
  }

  return {
    label: t('restore.action'),
    busy,
    message: outcome === null ? null : t(`restore.${outcome}`),
    restore: () => void run(),
  };
}
