import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'onboarding.title': 'Tanıtım',
  'onboarding.continue': 'Devam et',
  'settings.title': 'Ayarlar',
  'settings.comingSoon': 'Ayarlar #4 ile gelecek.',
  'settings.appearance.system': 'Sistem',
  'settings.appearance.light': 'Açık',
  'settings.appearance.dark': 'Koyu',
};
