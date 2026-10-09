import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultReminderSettings, reminderSwitchIsOn } from './reminder-switch-state.ts';

test('a fresh install starts with the reminder switch off', () => {
  assert.equal(defaultReminderSettings.enabled, false);
  assert.equal(reminderSwitchIsOn(defaultReminderSettings.enabled, false, false), false);
});

test('stored enabled state is shown on only with permission and a scheduled reminder', () => {
  assert.equal(reminderSwitchIsOn(true, false, true), false);
  assert.equal(reminderSwitchIsOn(true, true, false), false);
  assert.equal(reminderSwitchIsOn(true, true, true), true);
});
