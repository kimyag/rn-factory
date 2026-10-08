import type { AppSettings } from './settings.ts';

export function blockedReminderPermissions(settings: Pick<AppSettings, 'modules'>): string[] {
  return settings.modules.reminders ? [] : ['android.permission.RECEIVE_BOOT_COMPLETED'];
}
