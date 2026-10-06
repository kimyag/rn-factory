import assert from 'node:assert/strict';
import test from 'node:test';

import { testSettings as template } from './test-settings.ts';
import { sanitizeCrashEvent } from './crash-data.ts';
import { sentryPlugin, telemetryPrivacyManifest } from './telemetry-config.ts';
import { consentRequest } from './telemetry-network.ts';
import { createTelemetry, needsAnalyticsChoice, telemetryCapabilities, telemetryStorage, type TelemetryVendors } from './telemetry.ts';

const settings = {
  ...template,
  telemetry: {
    sentryDsn: 'https://public@example.com/1', sentryOrganization: 'factory', sentryProject: 'template',
    posthogApiKey: 'phc_test', posthogHost: 'https://eu.i.posthog.com',
  },
};

function fixture(loadOverride?: () => Promise<TelemetryVendors>, configured = settings) {
  let data: Record<string, string> = {};
  let loads = 0;
  let crashStarts = 0;
  let crashes = 0;
  const clients: { active: () => boolean; captureCount: number; store: ReturnType<typeof telemetryStorage> }[] = [];
  const storage = telemetryStorage({ get: () => data, set: (value) => { data = value; } });
  const vendors: TelemetryVendors = {
    startCrashes() {
      crashStarts += 1;
      return { capture() { crashes += 1; }, close: async () => {} };
    },
    startAnalytics(_key, _host, store, active) {
      const client = { active, captureCount: 0, store };
      clients.push(client);
      store.setItem('identity', 'random');
      return {
        capture() { client.captureCount += 1; },
        stop() { store.setItem('late_write', 'discard'); },
      };
    },
  };
  const controller = createTelemetry(configured, storage, async () => {
    loads += 1;
    return loadOverride ? loadOverride() : vendors;
  });
  return { controller, vendors, clients, storage, state: () => ({ loads, crashStarts, crashes, data }) };
}

test('placeholder and disabled settings never initialize either SDK', async () => {
  for (const configured of [template, { ...settings, modules: { ...settings.modules, crashReports: false, analytics: false } }]) {
    const f = fixture(undefined, configured);
    f.controller.setAnalyticsChoice(true);
    await f.controller.track('theme_changed');
    await f.controller.reportCrash(new Error('test'));
    assert.equal(f.state().loads, 0);
  }
});

test('crashes initialize once and report without an analytics choice', async () => {
  const f = fixture();
  await Promise.all([f.controller.reportCrash(new Error('one')), f.controller.reportCrash(new Error('two'))]);
  assert.equal(f.state().crashStarts, 1);
  assert.equal(f.state().crashes, 2);
  assert.equal(f.clients.length, 0);
});

test('unknown and declined consent do not create analytics or queue events', async () => {
  const f = fixture();
  await f.controller.track('theme_changed');
  f.controller.setAnalyticsChoice(false);
  await f.controller.track('language_changed');
  assert.equal(f.state().loads, 0);
  assert.equal(f.clients.length, 0);
});

test('sharing initializes analytics and withdrawal clears identity and rejects late storage writes', async () => {
  const f = fixture();
  f.controller.setAnalyticsChoice(true);
  await f.controller.track('onboarding_completed');
  assert.equal(f.clients[0].captureCount, 1);
  assert.equal(f.state().data.identity, 'random');
  f.controller.setAnalyticsChoice(false);
  f.clients[0].store.setItem('queue', 'late');
  assert.deepEqual(f.state().data, {});
  assert.equal(f.clients[0].active(), false);
  await f.controller.track('theme_changed');
  assert.equal(f.clients[0].captureCount, 1);
});

test('withdrawal during SDK loading prevents initialization and pending captures', async () => {
  let resolve!: (vendors: TelemetryVendors) => void;
  const pending = new Promise<TelemetryVendors>((done) => { resolve = done; });
  const f = fixture(() => pending);
  f.controller.setAnalyticsChoice(true);
  const capture = f.controller.track('theme_changed');
  f.controller.setAnalyticsChoice(false);
  resolve(f.vendors);
  await capture;
  assert.equal(f.clients.length, 0);
});

test('a new opt-in cannot reactivate an old SDK queue or retry transport', async () => {
  const f = fixture();
  f.controller.setAnalyticsChoice(true);
  await f.controller.track('theme_changed');
  f.controller.setAnalyticsChoice(false);
  f.controller.setAnalyticsChoice(true);
  await f.controller.track('language_changed');
  let sends = 0;
  const send = async () => { sends += 1; return 'sent'; };
  assert.equal(await consentRequest(f.clients[0].active, send, 'dropped'), 'dropped');
  assert.equal(await consentRequest(f.clients[1].active, send, 'dropped'), 'sent');
  assert.equal(sends, 1);
  f.clients[0].store.setItem('old_queue', 'late');
  assert.equal(f.state().data.old_queue, undefined);
});

test('a disposed app cannot initialize SDKs after a late import', async () => {
  let resolve!: (vendors: TelemetryVendors) => void;
  const pending = new Promise<TelemetryVendors>((done) => { resolve = done; });
  const f = fixture(() => pending);
  const crash = f.controller.reportCrash(new Error('test'));
  f.controller.dispose();
  resolve(f.vendors);
  await crash;
  assert.equal(f.state().crashStarts, 0);
});

test('SDK failures cannot break the app', async () => {
  const f = fixture(async () => { throw new Error('SDK unavailable'); });
  f.controller.setAnalyticsChoice(true);
  await f.controller.track('theme_changed');
  await f.controller.reportCrash(new Error('test'));
});

test('consent is requested only while the module is enabled and a choice is missing', () => {
  assert.equal(needsAnalyticsChoice(true, null), true);
  assert.equal(needsAnalyticsChoice(false, null), false);
  assert.equal(needsAnalyticsChoice(true, true), false);
  assert.equal(needsAnalyticsChoice(true, false), false);
});

test('module switches are independent and storage uses a typed key map', () => {
  assert.deepEqual(telemetryCapabilities({ ...settings, modules: { ...settings.modules, analytics: false } }), { crashes: true, analytics: false });
  const f = fixture();
  assert.equal(f.storage.getItem('missing'), null);
  f.storage.setItem('one', '1');
  f.storage.setItem('two', '2');
  assert.deepEqual(f.state().data, { one: '1', two: '2' });
});

test('privacy declarations reflect linked pseudonymous analytics but never ATT tracking', () => {
  const manifest = telemetryPrivacyManifest(settings);
  assert.equal(manifest.NSPrivacyTracking, false);
  assert.deepEqual(manifest.NSPrivacyTrackingDomains, []);
  const device = manifest.NSPrivacyCollectedDataTypes.find((type) => type.NSPrivacyCollectedDataType.endsWith('DeviceID'));
  assert.equal(device?.NSPrivacyCollectedDataTypeLinked, true);
  assert.ok(manifest.NSPrivacyCollectedDataTypes.every((type) => !type.NSPrivacyCollectedDataTypeTracking));
  const disabled = telemetryPrivacyManifest({ ...settings, modules: { ...settings.modules, analytics: false, crashReports: false } });
  assert.deepEqual(disabled.NSPrivacyCollectedDataTypes, []);
});

test('native upload plugin cannot run with placeholder settings', () => {
  assert.deepEqual(sentryPlugin(template), []);
  assert.equal(sentryPlugin(settings)[0]?.[0], '@sentry/react-native/expo');
  assert.deepEqual(sentryPlugin({ ...settings, modules: { ...settings.modules, crashReports: false } }), []);
});

test('crash payload strips arbitrary identity/content but retains stack and app/OS versions', () => {
  const event = sanitizeCrashEvent({
    user: { email: 'private@example.com' }, request: { url: 'https://example.com/private' },
    extra: { draft: 'private' }, tags: { account: 'private' }, fingerprint: ['private'],
    message: 'private', transaction: '/private', server_name: 'private', breadcrumbs: [{ message: 'private' }],
    contexts: { app: { app_version: '1.0', private: 'secret' }, os: { name: 'Android', version: '16' }, device: { id: 'private' } },
    exception: { values: [{ type: 'TypeError', value: 'private', stacktrace: { frames: [{
      filename: 'app:///bundle.js?private=secret', lineno: 10, vars: { draft: 'private' }, context_line: 'private',
    }] } }] },
  });
  for (const key of ['user', 'request', 'extra', 'tags', 'fingerprint', 'message', 'transaction', 'server_name', 'breadcrumbs']) {
    assert.equal(key in event, false);
  }
  assert.equal(event.contexts?.app?.app_version, '1.0');
  assert.equal(event.contexts?.app?.private, undefined);
  assert.equal(event.contexts?.device, undefined);
  assert.equal(event.exception?.values?.[0].value, 'TypeError');
  assert.deepEqual(event.exception?.values?.[0].stacktrace?.frames?.[0], { filename: 'app:///bundle.js', lineno: 10 });
});
