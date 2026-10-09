import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearLegacyReminderId,
  createReminderOsStore,
  defaultReminderSettings,
  disableReminder,
  getLegacyReminderId,
  migrateReminderSettings,
  reminderSwitchIsOn,
} from './reminder-switch-state.ts';

test('a fresh install starts with the reminder switch off', () => {
  assert.equal(defaultReminderSettings.wantsReminders, false);
  assert.equal(reminderSwitchIsOn(defaultReminderSettings.wantsReminders, false, false), false);
});

test('the switch is derived from user intent and current OS state', () => {
  assert.equal(reminderSwitchIsOn(true, false, true), false);
  assert.equal(reminderSwitchIsOn(true, true, false), false);
  assert.equal(reminderSwitchIsOn(true, null, null), false);
  assert.equal(reminderSwitchIsOn(true, true, true), true);
});

test('the stored choice migration keeps intent and captures the old notification only in memory', () => {
  const migrated = migrateReminderSettings({ enabled: true, time: '08:30', id: 'legacy-id' }, 1);
  assert.deepEqual(migrated, { wantsReminders: true, time: '08:30' });
  assert.equal(getLegacyReminderId(), 'legacy-id');
  clearLegacyReminderId('legacy-id');
});

test('disabling saves off before awaiting scheduled reminder cancellation', async () => {
  const current = { wantsReminders: true, time: '09:00' };
  let stored = current;
  let cancellationStarted = false;
  let finishCancellation: (() => void) | undefined;
  const cancellation = new Promise<void>((resolve) => {
    finishCancellation = resolve;
  });

  const disabling = disableReminder(current, async () => {
    cancellationStarted = true;
    await cancellation;
  }, (next) => {
    stored = next;
  });

  assert.equal(cancellationStarted, true);
  assert.equal(stored.wantsReminders, false);
  assert.equal(reminderSwitchIsOn(stored.wantsReminders, true, true), false);

  finishCancellation?.();
  await disabling;
  assert.deepEqual(stored, { wantsReminders: false, time: '09:00' });
});

test('the OS store refreshes on foreground and ignores older pending reads', async () => {
  const pendingReads: ((state: { permissionGranted: boolean | null; scheduled: boolean | null }) => void)[] = [];
  let onForeground: (() => void) | null = null;
  let foregroundUnsubscribed = false;
  const store = createReminderOsStore(
    () => new Promise((resolve) => pendingReads.push(resolve)),
    (callback) => {
      onForeground = callback;
      return () => {
        foregroundUnsubscribed = true;
      };
    },
  );
  const unsubscribe = store.subscribe(() => undefined);

  assert.equal(pendingReads.length, 1);
  onForeground?.();
  assert.equal(pendingReads.length, 2);
  pendingReads[1]?.({ permissionGranted: true, scheduled: true });
  await Promise.resolve();
  assert.deepEqual(store.getSnapshot(), { permissionGranted: true, scheduled: true });
  pendingReads[0]?.({ permissionGranted: false, scheduled: false });
  await Promise.resolve();
  assert.deepEqual(store.getSnapshot(), { permissionGranted: true, scheduled: true });

  unsubscribe();
  assert.equal(foregroundUnsubscribed, true);
});
