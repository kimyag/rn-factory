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
  type PremiumDetails,
  type PurchaseResult,
  type RestoreResult,
  fallbackManagementUrl,
  premiumSummary,
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
const modules = { payments: true, ai: false, crashReports: false, analytics: false };
const bundleIds = { ios: 'com.example.app', android: 'com.example.app' };
const configured: PaymentsSettings = { modules, payments: keys, bundleIds };
const monthlyDetails: PremiumDetails = { expires: '2026-11-06T00:00:00Z', renews: true, billingIssue: false };
const development: PaymentsEnvironment = { platform: 'android', development: true };
const release: PaymentsEnvironment = { platform: 'android', development: false };
const monthly: Plan = { id: '$rc_monthly', period: 'month', price: '₺49.99' };

type Overrides = { purchase?: PurchaseResult; restore?: RestoreResult; link?: string | null };

function fixture(settings: PaymentsSettings, environment: PaymentsEnvironment, overrides: Overrides = {}) {
  const calls: string[] = [];
  let loads = 0;
  let notify: ((details: PremiumDetails | null) => void) | undefined;
  const vendor: PaymentsVendor = {
    configure: (apiKey) => calls.push(`configure ${apiKey}`),
    identify: async (appUserId) => { calls.push(`identify ${appUserId}`); },
    entitlementDetails: async (entitlement) => {
      calls.push(`entitlement ${entitlement}`);
      return monthlyDetails;
    },
    plans: async () => [monthly],
    purchase: async (planId) => {
      calls.push(`purchase ${planId}`);
      return overrides.purchase ?? 'purchased';
    },
    restore: async (entitlement) => {
      calls.push(`restore ${entitlement}`);
      return overrides.restore ?? { outcome: 'restored', entitlements: [entitlement] };
    },
    managementUrl: async () => (overrides.link === undefined ? 'https://manage.example.com' : overrides.link),
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
  return { payments, calls, loads: () => loads, notify: (details: PremiumDetails | null) => notify?.(details) };
}

test('payments off, web, and placeholder keys never load the vendor', async () => {
  const inactive: [PaymentsSettings, PaymentsEnvironment][] = [
    [{ modules: { ...modules, payments: false }, payments: keys, bundleIds }, development],
    [configured, { platform: 'web', development: true }],
    [{ modules, payments: placeholders, bundleIds }, development],
    [{ modules, payments: { ...placeholders, revenueCatTestStoreApiKey: 'test_store' }, bundleIds }, release],
  ];
  for (const [settings, environment] of inactive) {
    const f = fixture(settings, environment);
    assert.equal(f.payments.available, false);
    assert.equal(await f.payments.entitlement(), null);
    assert.deepEqual(await f.payments.plans(), []);
    assert.equal(await f.payments.purchase(monthly), 'failed');
    assert.deepEqual(await f.payments.restore(), { outcome: 'nothing', entitlements: [] });
    f.payments.onEntitlementChange(() => assert.fail('no listener without a vendor'))();
    assert.equal(f.loads(), 0);
    assert.deepEqual(f.calls, []);
  }
});

test('a release build uses the store key of its platform and never the Test Store key', () => {
  assert.equal(paymentsApiKey(configured, { platform: 'ios', development: false }), 'appl_ios');
  assert.equal(paymentsApiKey(configured, release), 'goog_android');
  const testKeyOnly = { modules, payments: { ...placeholders, revenueCatTestStoreApiKey: 'test_store' }, bundleIds };
  assert.equal(paymentsApiKey(testKeyOnly, release), null);
  assert.equal(paymentsApiKey(testKeyOnly, { platform: 'ios', development: false }), null);
});

test('a development build uses the Test Store key, or the store key while that is a placeholder', () => {
  assert.equal(paymentsApiKey(configured, development), 'test_store');
  assert.equal(paymentsApiKey(configured, { platform: 'ios', development: true }), 'test_store');
  const storeKeysOnly = { modules, payments: { ...keys, revenueCatTestStoreApiKey: placeholders.revenueCatTestStoreApiKey }, bundleIds };
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
  assert.deepEqual(await f.payments.entitlement(), monthlyDetails);
  assert.deepEqual(await f.payments.plans(), [monthly]);
  assert.equal(await f.payments.purchase(monthly), 'purchased');
  assert.deepEqual(await f.payments.restore(), { outcome: 'restored', entitlements: [premiumEntitlement] });
  assert.deepEqual(f.calls, [
    'configure goog_android',
    `entitlement ${premiumEntitlement}`,
    'purchase $rc_monthly',
    `restore ${premiumEntitlement}`,
  ]);
});

test('an entitlement listener hears changes until it is stopped', async () => {
  const f = fixture(configured, development);
  const heard: (PremiumDetails | null)[] = [];
  const stop = f.payments.onEntitlementChange((details) => heard.push(details));
  await f.payments.entitlement();
  f.notify(monthlyDetails);
  stop();
  f.notify(null);
  assert.deepEqual(heard, [monthlyDetails]);

  const stoppedEarly = fixture(configured, development);
  stoppedEarly.payments.onEntitlementChange(() => assert.fail('stopped before the vendor was ready'))();
  await stoppedEarly.payments.entitlement();
  stoppedEarly.notify(monthlyDetails);
});

test('a pending purchase is reported as pending, not failed', async () => {
  const f = fixture(configured, release, { purchase: 'pending' });
  assert.equal(await f.payments.purchase(monthly), 'pending');
});

test('restore tells no purchase apart from a purchase that is not premium', async () => {
  const none = fixture(configured, release, { restore: { outcome: 'nothing', entitlements: [] } });
  assert.equal((await none.payments.restore()).outcome, 'nothing');
  const other = fixture(configured, release, { restore: { outcome: 'notPremium', entitlements: ['pro'] } });
  assert.deepEqual(await other.payments.restore(), { outcome: 'notPremium', entitlements: ['pro'] });
});

test('manage opens the RevenueCat link, or the store subscription page without one', async () => {
  assert.equal(await fixture(configured, release).payments.managementUrl(), 'https://manage.example.com');
  const noLink = fixture(configured, release, { link: null });
  assert.equal(await noLink.payments.managementUrl(), 'https://play.google.com/store/account/subscriptions?package=com.example.app');
  assert.equal(fallbackManagementUrl({ bundleIds }, 'ios'), 'https://apps.apple.com/account/subscriptions');
  const off = fixture({ ...configured, modules: { ...modules, payments: false } }, release);
  assert.equal(await off.payments.managementUrl(), 'https://play.google.com/store/account/subscriptions?package=com.example.app');
});

test('the premium summary says when it renews, ends, never expires, or has a payment problem', () => {
  assert.deepEqual(premiumSummary(monthlyDetails), [{ key: 'premium.renews', date: monthlyDetails.expires }]);
  assert.deepEqual(premiumSummary({ ...monthlyDetails, renews: false }), [{ key: 'premium.ends', date: monthlyDetails.expires }]);
  assert.deepEqual(premiumSummary({ expires: null, renews: false, billingIssue: false }), [{ key: 'premium.lifetime', date: null }]);
  assert.deepEqual(
    premiumSummary({ ...monthlyDetails, billingIssue: true }).map((line) => line.key),
    ['premium.renews', 'premium.billingIssue'],
  );
});
