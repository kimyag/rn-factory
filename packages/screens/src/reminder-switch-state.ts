export type ReminderStoredSettings = { enabled: boolean; time: string; id: string | null };

export const defaultReminderSettings: ReminderStoredSettings = { enabled: false, time: '09:00', id: null };

export function reminderSwitchIsOn(storedEnabled: boolean, permissionGranted: boolean, scheduled: boolean): boolean {
  return storedEnabled && permissionGranted && scheduled;
}

export async function disableReminder(
  current: ReminderStoredSettings,
  cancel: (id: string) => Promise<void>,
  save: (next: ReminderStoredSettings) => void,
): Promise<void> {
  const disabled = { ...current, enabled: false };
  save(disabled);
  if (current.id !== null) {
    await cancel(current.id);
    save({ ...disabled, id: null });
  }
}
