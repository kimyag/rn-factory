import type { AppSettings } from './settings.ts';

// Google's billing library adds this permission to every build that links the
// payments SDK; an app with payments off must not request it.
export function blockedAndroidPermissions(settings: Pick<AppSettings, 'modules'>): string[] {
  return settings.modules.payments ? [] : ['com.android.vending.BILLING'];
}
