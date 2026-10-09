import {
  cancelReminder,
  cancelRemindersByKey,
  hasReminderPermission,
  listReminders,
} from '@factory/reminders';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { clearLegacyReminderId, createReminderOsStore, getLegacyReminderId } from './reminder-switch-state.ts';

export const settingsReminderKey = 'settings-daily';

async function readReminderOsState() {
  const [permissionGranted, reminders] = await Promise.all([
    hasReminderPermission().catch(() => null),
    listReminders().catch(() => null),
  ]);
  const legacyId = getLegacyReminderId();
  return {
    permissionGranted,
    scheduled: reminders === null
      ? null
      : reminders.some(({ id, key }) => key === settingsReminderKey || id === legacyId),
  };
}

const reminderOsStore = createReminderOsStore(readReminderOsState, (onForeground) => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      onForeground();
    }
  });
  return () => subscription.remove();
});

export function useReminderOsState() {
  return useSyncExternalStore(
    reminderOsStore.subscribe,
    reminderOsStore.getSnapshot,
    reminderOsStore.getSnapshot,
  );
}

export function refreshReminderOsState() {
  return reminderOsStore.refresh();
}

export async function cancelSettingsReminder(): Promise<void> {
  const legacyId = getLegacyReminderId();
  if (legacyId !== null) {
    const reminders = await listReminders();
    if (reminders.some(({ id }) => id === legacyId)) {
      await cancelReminder(legacyId);
    }
    clearLegacyReminderId(legacyId);
  }
  await cancelRemindersByKey(settingsReminderKey);
}
