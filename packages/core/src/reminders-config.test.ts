import assert from 'node:assert/strict';
import test from 'node:test';

import { blockedReminderPermissions } from './reminders-config.ts';

const modules = { payments: true, crashReports: true, analytics: true, ai: false, reminders: true };

test('the reminders module blocks its Android boot permission when disabled', () => {
  assert.deepEqual(blockedReminderPermissions({ modules }), []);
  assert.deepEqual(blockedReminderPermissions({ modules: { ...modules, reminders: false } }), [
    'android.permission.RECEIVE_BOOT_COMPLETED',
  ]);
});
