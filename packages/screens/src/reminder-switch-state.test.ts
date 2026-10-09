import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultReminderSettings, disableReminder, reminderSwitchIsOn } from './reminder-switch-state.ts';

test('a fresh install starts with the reminder switch off', () => {
  assert.equal(defaultReminderSettings.enabled, false);
  assert.equal(reminderSwitchIsOn(defaultReminderSettings.enabled, false, false), false);
});

test('stored enabled state is shown on only with permission and a scheduled reminder', () => {
  assert.equal(reminderSwitchIsOn(true, false, true), false);
  assert.equal(reminderSwitchIsOn(true, true, false), false);
  assert.equal(reminderSwitchIsOn(true, true, true), true);
});

test('disabling saves off immediately while it cancels the scheduled reminder', async () => {
  const current = { enabled: true, time: '09:00', id: 'reminder-1' };
  let stored = current;
  let cancelledId: string | null = null;
  let finishCancellation: (() => void) | undefined;
  const cancellation = new Promise<void>((resolve) => {
    finishCancellation = resolve;
  });

  const disabling = disableReminder(current, async (id) => {
    cancelledId = id;
    await cancellation;
  }, (next) => {
    stored = next;
  });

  assert.equal(cancelledId, 'reminder-1');
  assert.equal(stored.enabled, false);
  assert.equal(reminderSwitchIsOn(stored.enabled, true, true), false);

  finishCancellation?.();
  await disabling;
  assert.deepEqual(stored, { enabled: false, time: '09:00', id: null });
});
