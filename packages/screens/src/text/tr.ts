import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'onboarding.title': 'Tanıtım',
  'onboarding.continue': 'Devam et',
  'settings.title': 'Ayarlar',
  'settings.theme': 'Tema',
  'settings.theme.system': 'Sistem',
  'settings.theme.light': 'Açık',
  'settings.theme.dark': 'Koyu',
  'settings.language': 'Dil',
  'settings.language.system': 'Sistem',
  'settings.about': 'Hakkında',
  'settings.privacy': 'Gizlilik politikası',
  'settings.contact': 'İletişim',
  'settings.rate': 'Uygulamayı değerlendir',
  'settings.restore': 'Satın alımları geri yükle',
  'settings.version': 'Sürüm',
};
