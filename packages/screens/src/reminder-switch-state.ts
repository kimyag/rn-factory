export type ReminderStoredSettings = { enabled: boolean; time: string; id: string | null };

export const defaultReminderSettings: ReminderStoredSettings = { enabled: false, time: '09:00', id: null };

export function reminderSwitchIsOn(storedEnabled: boolean, permissionGranted: boolean, scheduled: boolean): boolean {
  return storedEnabled && permissionGranted && scheduled;
}
