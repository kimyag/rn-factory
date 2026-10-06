import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'analytics.title': 'Kullanım paylaşımı',
  'analytics.explanation': 'Uygulamayı geliştirmek için kullandığınız özellikleri rastgele bir kimlikle paylaşın.',
  'analytics.share': 'Paylaş',
  'analytics.dontShare': 'Paylaşma',
  'error.title': 'Bu ekran açılamadı',
  'error.message': 'Ekranı yeniden açmak için tekrar deneyin.',
  'error.repeated': 'Bu ekran hâlâ açılamadı. Tekrar deneyin veya uygulamanın başlangıcına dönün.',
  'error.retry': 'Tekrar dene',
  'error.goToStart': 'Başa dön',
  'onboarding.skip': 'Atla',
  'onboarding.next': 'İleri',
  'onboarding.done': 'Başla',
  'onboarding.progress': 'Sayfa {current} / {total}',
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
  'settings.version': 'Sürüm',
  'settings.premium': 'Premium',
  'settings.premium.plans': 'Planları gör',
  'settings.premium.active': 'Premium etkin',
};
