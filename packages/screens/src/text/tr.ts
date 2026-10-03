import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'error.title': 'Bu ekran açılamadı',
  'error.message': 'Ekranı yeniden açmak için tekrar deneyin.',
  'error.repeated': 'Bu ekran hâlâ açılamadı. Tekrar deneyin veya uygulamanın başlangıcına dönün.',
  'error.retry': 'Tekrar dene',
  'error.goToStart': 'Başa dön',
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
