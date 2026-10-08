import assert from 'node:assert/strict';
import test from 'node:test';

import { blockedAndroidPermissions } from './payments-config.ts';
import { appSettingsSchema } from './settings.ts';

const modules = { payments: true, ai: false, crashReports: false, analytics: false, reminders: true };

test('only an app with payments off blocks the Android billing permission', () => {
  assert.deepEqual(blockedAndroidPermissions({ modules }), []);
  assert.deepEqual(blockedAndroidPermissions({ modules: { ...modules, payments: false } }), [
    'com.android.vending.BILLING',
  ]);
});

test('each RevenueCat key field accepts only its own key type or a placeholder', () => {
  const keys = appSettingsSchema.shape.payments;
  const placeholders = {
    revenueCatIosApiKey: 'REVENUECAT_IOS_API_KEY_PLACEHOLDER',
    revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
    revenueCatTestStoreApiKey: 'REVENUECAT_TEST_STORE_API_KEY_PLACEHOLDER',
  };
  assert.equal(keys.safeParse(placeholders).success, true);
  assert.equal(
    keys.safeParse({
      revenueCatIosApiKey: 'appl_abc123',
      revenueCatAndroidApiKey: 'goog_abc123',
      revenueCatTestStoreApiKey: 'test_abc123',
    }).success,
    true,
  );
  // A Test Store key in a store field would reach release builds, where the SDK crashes on it.
  assert.equal(keys.safeParse({ ...placeholders, revenueCatIosApiKey: 'test_abc123' }).success, false);
  assert.equal(keys.safeParse({ ...placeholders, revenueCatAndroidApiKey: 'test_abc123' }).success, false);
  assert.equal(keys.safeParse({ ...placeholders, revenueCatTestStoreApiKey: 'goog_abc123' }).success, false);
});
