import assert from 'node:assert/strict';
import test from 'node:test';

import { connectedDevices, devClientLink, maestroArgs, parseArgs, selectFlows, type Flow } from './maestro-lib.ts';

const flows: Flow[] = [
  { name: 'onboarding-pages', file: '/m/onboarding-pages.yaml' },
  { name: 'settings', file: '/m/settings.yaml' },
];

test('options have defaults, take flags, and collect flow names', () => {
  assert.deepEqual(parseArgs([]), { app: 'template-app', lang: 'en', theme: 'dark', server: null, names: [] });
  assert.deepEqual(parseArgs(['settings', '--lang', 'tr', '--theme', 'light', '--server', 'http://10.0.0.2:8081/']), {
    app: 'template-app', lang: 'tr', theme: 'light', server: 'http://10.0.0.2:8081', names: ['settings'],
  });
});

test('bad options say what is wrong', () => {
  assert.throws(() => parseArgs(['--theme', 'blue']), /--theme must be one of/);
  assert.throws(() => parseArgs(['--lang']), /needs a value/);
  assert.throws(() => parseArgs(['--colour', 'red']), /Unknown option/);
});

test('no names selects every flow; a name selects one; an unknown name lists the flows', () => {
  assert.deepEqual(selectFlows(flows, []), flows);
  assert.deepEqual(selectFlows(flows, ['settings']), [flows[1]]);
  assert.throws(() => selectFlows(flows, ['nope']), /No flow named nope\. Flows: onboarding-pages, settings/);
});

test('the dev client link encodes the server address', () => {
  assert.equal(
    devClientLink('template-app', 'http://192.168.1.5:8081'),
    'exp+template-app://expo-development-client/?url=http%3A%2F%2F192.168.1.5%3A8081',
  );
});

test('flow values are passed to Maestro as env variables', () => {
  const args = maestroArgs(flows[1] as Flow, { appId: 'com.example.app', link: 'exp+x://l', lang: 'tr', theme: 'dark' });
  assert.deepEqual(args, [
    'test', '-e', 'APP_ID=com.example.app', '-e', 'DEV_CLIENT_LINK=exp+x://l', '-e', 'LANG_CODE=tr', '-e', 'THEME=dark',
    '/m/settings.yaml',
  ]);
});

test('only devices in the device state count', () => {
  const output = 'List of devices attached\nABC123\tdevice usb:1\nDEF456\tunauthorized usb:2\nemulator-5554\toffline\n\n';
  assert.deepEqual(connectedDevices(output), ['ABC123']);
  assert.deepEqual(connectedDevices('List of devices attached\n\n'), []);
});
