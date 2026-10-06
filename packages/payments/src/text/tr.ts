import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'paywall.close': 'Kapat',
  'paywall.price.month': 'Ayda {price}',
  'paywall.price.year': 'Yılda {price}',
  'paywall.price.lifetime': 'Tek seferde {price}',
  'paywall.cancel.ios':
    'Abonelikler siz iptal edene kadar otomatik yenilenir. İstediğiniz zaman App Store hesap ayarlarınızdan iptal edebilirsiniz.',
  'paywall.cancel.android':
    'Abonelikler siz iptal edene kadar otomatik yenilenir. İstediğiniz zaman Google Play’de Ödemeler ve abonelikler bölümünden iptal edebilirsiniz.',
  'paywall.lifetime': 'Tek seferlik satın alma yenilenmez.',
  'paywall.continue': 'Devam et',
  'paywall.privacy': 'Gizlilik politikası',
  'paywall.active': 'Premium etkin.',
  'paywall.unavailable': 'Bu cihazda satın alma yapılamıyor.',
  'paywall.loadFailed': 'Planlar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
  'paywall.retry': 'Tekrar dene',
  'paywall.purchaseFailed': 'Satın alma tamamlanamadı. Tekrar deneyin.',
  'paywall.purchasePending':
    'Ödemeniz beklemede. Premium, mağaza onayladığında başlar; bu biraz zaman alabilir.',
  'restore.action': 'Satın alımları geri yükle',
  'restore.restored': 'Satın alımınız geri yüklendi.',
  'restore.nothing': 'Bu mağaza hesabında önceki bir satın alma bulunamadı.',
  'restore.notPremium':
    'Bu mağaza hesabında bir satın alma bulundu, ancak premium içermiyor. Süresi dolmuş olabilir.',
  'restore.devHint': 'Geliştirme: bu hesaptaki RevenueCat yetkileri: {found}. Uygulamanın beklediği: "{needed}".',
  'premium.lifetime': 'Tek seferlik satın alma. Süresi dolmaz.',
  'premium.renews': '{date} tarihinde yenilenir.',
  'premium.ends': '{date} tarihinde sona erer. Yenilenmez.',
  'premium.billingIssue': 'Mağaza son ödemenizi alamadı. Ödeme yönteminizi mağazada güncelleyin.',
  'restore.failed': 'Geri yükleme başarısız oldu. Bağlantınızı kontrol edip tekrar deneyin.',
};
