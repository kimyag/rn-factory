import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { connectedDevices, devClientLink, flowSkipReason, maestroArgs, parseArgs, paymentsActive, selectFlows, type Flow } from './maestro-lib.ts';
import { prepareFlow, preparePreviewFlow } from './maestro-flow.ts';

const flows: Flow[] = [
  { name: 'onboarding-pages', file: '/m/onboarding-pages.yaml' },
  { name: 'settings', file: '/m/settings.yaml' },
];

test('options have defaults, take flags, and collect flow names', () => {
  assert.deepEqual(parseArgs([]), { app: 'template-app', lang: 'en', theme: 'dark', server: null, preview: false, names: [] });
  assert.deepEqual(parseArgs(['settings', '--lang', 'tr', '--theme', 'light', '--server', 'http://10.0.0.2:8081/']), {
    app: 'template-app', lang: 'tr', theme: 'light', server: 'http://10.0.0.2:8081', preview: false, names: ['settings'],
  });
  assert.deepEqual(parseArgs(['settings', '--preview']), {
    app: 'template-app', lang: 'en', theme: 'dark', server: null, preview: true, names: ['settings'],
  });
});

test('bad options say what is wrong', () => {
  assert.throws(() => parseArgs(['--theme', 'blue']), /--theme must be one of/);
  assert.throws(() => parseArgs(['--lang']), /needs a value/);
  assert.throws(() => parseArgs(['--colour', 'red']), /Unknown option/);
  assert.throws(() => parseArgs(['--preview', '--server', 'http://localhost:8081']), /cannot be combined/);
});

test('payment availability follows the development Test Store and release store keys', () => {
  const settings = {
    modules: { payments: true },
    payments: {
      revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
      revenueCatTestStoreApiKey: 'test_example',
    },
  };
  assert.equal(paymentsActive(settings, true), true);
  assert.equal(paymentsActive(settings, false), false);
  assert.equal(paymentsActive({ ...settings, modules: { payments: false } }, true), false);
  assert.equal(paymentsActive({ ...settings, payments: { ...settings.payments, revenueCatAndroidApiKey: 'goog_example' } }, false), true);
});

test('the Test Store payment flow is skipped only for preview builds', () => {
  assert.match(flowSkipReason('payments', true) ?? '', /development build.*preview builds/);
  assert.equal(flowSkipReason('payments', false), null);
  assert.equal(flowSkipReason('settings', true), null);
});

test('no names selects every flow; a name selects one; an unknown name lists the flows', () => {
  assert.deepEqual(selectFlows(flows, []), flows);
  assert.deepEqual(selectFlows(flows, ['settings']), [flows[1]]);
  assert.throws(() => selectFlows(flows, ['nope']), /No flow named nope\. Flows: onboarding-pages, settings/);
});

test('the dev client link encodes the server address', () => {
  assert.equal(
    devClientLink('template-app', 'http://192.168.1.5:8081'),
    'exp+template-app://expo-development-client/?url=http%3A%2F%2F192.168.1.5%3A8081&disableOnboarding=1',
  );
});

test('preview flows launch the installed app without opening the dev client', () => {
  const temp = mkdtempSync(join(tmpdir(), 'maestro-preview-test-'));
  try {
    const shared = join(temp, 'shared');
    const app = join(temp, 'app');
    const output = join(temp, 'output');
    mkdirSync(join(shared, 'subflows'), { recursive: true });
    mkdirSync(app, { recursive: true });
    writeFileSync(join(shared, 'subflows', 'start.yaml'), 'dev start');
    writeFileSync(join(shared, 'subflows', 'preview-start.yaml'), 'preview start');
    writeFileSync(join(shared, 'settings.yaml'), 'appId: ${APP_ID}\n---\n- runFlow: subflows/start.yaml\n- takeScreenshot: settings');
    const flow = { name: 'settings', file: join(shared, 'settings.yaml') };

    const prepared = preparePreviewFlow(flow, shared, app, output);
    const contents = readFileSync(prepared.file, 'utf8');
    assert.match(contents, /runFlow: subflows\/preview-start\.yaml/);
    assert.doesNotMatch(contents, /runFlow: subflows\/start\.yaml/);
    assert.equal(readFileSync(join(output, 'subflows', 'preview-start.yaml'), 'utf8'), 'preview start');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('settings flow selects the active or hidden payment assertions from build configuration', () => {
  const temp = mkdtempSync(join(tmpdir(), 'maestro-settings-test-'));
  try {
    const shared = join(temp, 'shared');
    const app = join(temp, 'app');
    const output = join(temp, 'output');
    mkdirSync(join(shared, 'subflows'), { recursive: true });
    mkdirSync(app, { recursive: true });
    writeFileSync(join(shared, 'subflows', 'start.yaml'), 'dev start');
    writeFileSync(join(shared, 'subflows', 'preview-start.yaml'), 'preview start');
    writeFileSync(join(shared, 'subflows', 'settings-payments-active.yaml'), 'active payment assertions');
    writeFileSync(join(shared, 'subflows', 'settings-payments-inactive.yaml'), 'hidden payment assertions');
    writeFileSync(join(shared, 'settings.yaml'), [
      'appId: ${APP_ID}', '---', '- runFlow: subflows/start.yaml',
      '- runFlow: subflows/settings-payments-check.yaml',
    ].join('\n'));
    const flow = { name: 'settings', file: join(shared, 'settings.yaml') };

    const active = prepareFlow(flow, shared, app, output, true, true);
    assert.match(readFileSync(active.file, 'utf8'), /runFlow: subflows\/preview-start\.yaml/);
    assert.match(readFileSync(active.file, 'utf8'), /runFlow: subflows\/settings-payments-active\.yaml/);
    const inactive = prepareFlow(flow, shared, app, output, false, false);
    assert.match(readFileSync(inactive.file, 'utf8'), /runFlow: subflows\/start\.yaml/);
    assert.match(readFileSync(inactive.file, 'utf8'), /runFlow: subflows\/settings-payments-inactive\.yaml/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('flow values are passed to Maestro as env variables', () => {
  const args = maestroArgs(flows[1] as Flow, {
    appId: 'com.example.app', link: 'exp+x://l', server: 'http://10.0.0.2:8082', lang: 'tr', theme: 'dark',
  });
  assert.deepEqual(args, [
    'test', '-e', 'APP_ID=com.example.app', '-e', 'DEV_CLIENT_LINK=exp+x://l', '-e', 'SERVER_URL=http://10.0.0.2:8082',
    '-e', 'LANG_CODE=tr', '-e', 'THEME=dark', '/m/settings.yaml',
  ]);
});

test('only devices in the device state count', () => {
  const output = 'List of devices attached\nABC123\tdevice usb:1\nDEF456\tunauthorized usb:2\nemulator-5554\toffline\n\n';
  assert.deepEqual(connectedDevices(output), ['ABC123']);
  assert.deepEqual(connectedDevices('List of devices attached\n\n'), []);
});
