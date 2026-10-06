import assert from 'node:assert/strict';
import test from 'node:test';

import { testSettings as settings } from './test-settings.ts';
import { easConfig, easUpdateConfig } from './eas.ts';

test('every build profile selects its matching update channel and environment', () => {
  const { build } = easConfig(settings, '12.8.1');
  for (const profile of ['development', 'preview', 'production'] as const) {
    assert.equal(build[profile].channel, profile);
    assert.equal(build[profile].environment, profile);
  }
});

test('updates derive their endpoint from settings and use safe launch defaults', () => {
  assert.deepEqual(easUpdateConfig(settings.eas), {
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      enabled: true,
      url: `https://u.expo.dev/${settings.eas.projectId}`,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
  });
});

test('placeholder project identity cannot enable updates or make a placeholder endpoint', () => {
  const config = easUpdateConfig({ owner: 'EAS_OWNER_PLACEHOLDER', projectId: 'EAS_PROJECT_ID_PLACEHOLDER' });
  assert.equal(config.updates.enabled, false);
  assert.equal('url' in config.updates, false);
  assert.equal(easUpdateConfig({ ...settings.eas, owner: 'EAS_OWNER_PLACEHOLDER' }).updates.enabled, false);
});
