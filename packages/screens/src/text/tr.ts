import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'onboarding.skip': 'Atla',
  'onboarding.next': 'İleri',
  'onboarding.done': 'Başla',
  'onboarding.progress': 'Sayfa {current} / {total}',
  'settings.title': 'Ayarlar',
  'settings.comingSoon': 'Ayarlar #4 ile gelecek.',
  'settings.appearance.system': 'Sistem',
  'settings.appearance.light': 'Açık',
  'settings.appearance.dark': 'Koyu',
};
