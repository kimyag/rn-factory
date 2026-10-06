import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'feature.title': 'Özellik',
  'feature.body': 'Özellik ekranı',
  'onboarding.1.title': 'Hoş geldiniz',
  'onboarding.1.body': 'İlk tanıtım sayfası için yer tutucu. Her uygulama kendi sayfalarını yazar.',
  'onboarding.2.title': 'İkinci sayfa',
  'onboarding.2.body': 'İkinci sayfa için yer tutucu.',
  'onboarding.3.title': 'Üçüncü sayfa',
  'onboarding.3.body': 'Son sayfa için yer tutucu. Aşağıdaki düğme tanıtımı bitirir.',
  'paywall.title': 'Premium',
  'paywall.body': 'Premium ile gelenler için yer tutucu. Her uygulama kendi metnini yazar.',
};
