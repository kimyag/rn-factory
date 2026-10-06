import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPayments,
  paymentsApiKey,
  premiumEntitlement,
  type PaymentsEnvironment,
  type PaymentsSettings,
  type PaymentsVendor,
  type Plan,
} from './payments.ts';

const placeholders = {
  revenueCatIosApiKey: 'REVENUECAT_IOS_API_KEY_PLACEHOLDER',
  revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
  revenueCatTestStoreApiKey: 'REVENUECAT_TEST_STORE_API_KEY_PLACEHOLDER',
};
const keys = {
  revenueCatIosApiKey: 'appl_ios',
  revenueCatAndroidApiKey: 'goog_android',
  revenueCatTestStoreApiKey: 'test_store',
};
const modules = { payments: true, crashReports: false, analytics: false };
const configured: PaymentsSettings = { modules, payments: keys };
const development: PaymentsEnvironment = { platform: 'android', development: true };
const release: PaymentsEnvironment = { platform: 'android', development: false };
const monthly: Plan = { id: '$rc_monthly', period: 'month', price: '₺49.99' };

function fixture(settings: PaymentsSettings, environment: PaymentsEnvironment) {
  const calls: string[] = [];
  let loads = 0;
  let notify: ((active: boolean) => void) | undefined;
  const vendor: PaymentsVendor = {
    configure: (apiKey) => calls.push(`configure ${apiKey}`),
    entitlementActive: async (entitlement) => {
      calls.push(`entitlement ${entitlement}`);
      return true;
    },
    plans: async () => [monthly],
    purchase: async (planId) => {
      calls.push(`purchase ${planId}`);
      return 'purchased';
    },
    restore: async (entitlement) => {
      calls.push(`restore ${entitlement}`);
      return true;
    },
    onEntitlementChange: (_entitlement, listener) => {
      notify = listener;
      return () => {
        notify = undefined;
      };
    },
  };
  const payments = createPayments(settings, environment, async () => {
    loads += 1;
    return vendor;
  });
  return { payments, calls, loads: () => loads, notify: (active: boolean) => notify?.(active) };
}

test('payments off, web, and placeholder keys never load the vendor', async () => {
  const inactive: [PaymentsSettings, PaymentsEnvironment][] = [
    [{ modules: { ...modules, payments: false }, payments: keys }, development],
    [configured, { platform: 'web', development: true }],
    [{ modules, payments: placeholders }, development],
    [{ modules, payments: { ...placeholders, revenueCatTestStoreApiKey: 'test_store' } }, release],
  ];
  for (const [settings, environment] of inactive) {
    const f = fixture(settings, environment);
    assert.equal(f.payments.available, false);
    assert.equal(await f.payments.entitlement(), false);
    assert.deepEqual(await f.payments.plans(), []);
    assert.equal(await f.payments.purchase(monthly), 'failed');
    assert.equal(await f.payments.restore(), false);
    f.payments.onEntitlementChange(() => assert.fail('no listener without a vendor'))();
    assert.equal(f.loads(), 0);
    assert.deepEqual(f.calls, []);
  }
});

test('a release build uses the store key of its platform and never the Test Store key', () => {
  assert.equal(paymentsApiKey(configured, { platform: 'ios', development: false }), 'appl_ios');
  assert.equal(paymentsApiKey(configured, release), 'goog_android');
  const testKeyOnly = { modules, payments: { ...placeholders, revenueCatTestStoreApiKey: 'test_store' } };
  assert.equal(paymentsApiKey(testKeyOnly, release), null);
  assert.equal(paymentsApiKey(testKeyOnly, { platform: 'ios', development: false }), null);
});

test('a development build uses the Test Store key, or the store key while that is a placeholder', () => {
  assert.equal(paymentsApiKey(configured, development), 'test_store');
  assert.equal(paymentsApiKey(configured, { platform: 'ios', development: true }), 'test_store');
  const storeKeysOnly = { modules, payments: { ...keys, revenueCatTestStoreApiKey: placeholders.revenueCatTestStoreApiKey } };
  assert.equal(paymentsApiKey(storeKeysOnly, development), 'goog_android');
});

test('the vendor loads and is configured once, with the selected key', async () => {
  const f = fixture(configured, development);
  assert.equal(f.payments.available, true);
  assert.equal(f.loads(), 0);
  await Promise.all([f.payments.entitlement(), f.payments.plans(), f.payments.entitlement()]);
  assert.equal(f.loads(), 1);
  assert.deepEqual(f.calls.filter((call) => call.startsWith('configure')), ['configure test_store']);
});

test('entitlement, plans, purchase, and restore go through the vendor', async () => {
  const f = fixture(configured, release);
  assert.equal(await f.payments.entitlement(), true);
  assert.deepEqual(await f.payments.plans(), [monthly]);
  assert.equal(await f.payments.purchase(monthly), 'purchased');
  assert.equal(await f.payments.restore(), true);
  assert.deepEqual(f.calls, [
    'configure goog_android',
    `entitlement ${premiumEntitlement}`,
    'purchase $rc_monthly',
    `restore ${premiumEntitlement}`,
  ]);
});

test('an entitlement listener hears changes until it is stopped', async () => {
  const f = fixture(configured, development);
  const heard: boolean[] = [];
  const stop = f.payments.onEntitlementChange((active) => heard.push(active));
  await f.payments.entitlement();
  f.notify(true);
  stop();
  f.notify(false);
  assert.deepEqual(heard, [true]);

  const stoppedEarly = fixture(configured, development);
  stoppedEarly.payments.onEntitlementChange(() => assert.fail('stopped before the vendor was ready'))();
  await stoppedEarly.payments.entitlement();
  stoppedEarly.notify(true);
});
