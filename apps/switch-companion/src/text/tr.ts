import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'feature.title': 'Görevler',
  'feature.body': 'Görevleriniz burada görünecek.',
  'onboarding.1.title': 'Hoş geldiniz',
  'onboarding.1.body': 'Görev değiştirirken kaldığınız yeri koruyun.',
  'onboarding.2.title': 'Not bırakın',
  'onboarding.2.body': 'Not bırakın için yer tutucu.',
  'onboarding.3.title': 'Devam edin',
  'onboarding.3.body': 'Hazır olduğunuzda görevinize dönün.',
  'paywall.title': 'Premium',
  'paywall.body': 'Premium ile gelenler için yer tutucu. Her uygulama kendi metnini yazar.',
};
