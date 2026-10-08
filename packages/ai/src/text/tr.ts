import type { Translation } from '@factory/app';

import type { en } from './en.ts';

export const tr: Translation<typeof en> = {
  'disclosure.title': 'Metin yapay zekâya gönderilsin mi?',
  'disclosure.body': 'Girdiğiniz metin, yapılandırılmış yapay zekâ sağlayıcısına gönderilecek. Metni sunucumuzda saklamıyoruz. OpenRouter kullanıldığında metniniz başka bir model sağlayıcısına yönlendirilebilir. OpenRouter, istek ve yanıt içeriğinin kaydedilmesinin varsayılan olarak kapalı olduğunu ve hesap ayarlarından açılabildiğini belirtiyor; istek üst verilerini yine de saklıyor. Seçilen sağlayıcının kayıt, saklama ve eğitim kuralları ayrıdır ve farklılık gösterebilir. Lütfen paylaşma izniniz olmayan bilgileri çıkarın.',
  'disclosure.send': 'Yapay zekâya gönder',
  'disclosure.cancel': 'Vazgeç',
  'error.unavailable': 'Yapay zekâ şu anda kullanılamıyor. Daha sonra tekrar deneyin.',
  'error.unauthorized': 'Yapay zekâ oturumunuz sona erdi. Tekrar deneyin.',
  'error.too_long': 'Bu metin çok uzun. Kısaltıp tekrar deneyin.',
  'error.invalid_request': 'Metni kontrol edip tekrar deneyin.',
  'error.daily_limit': 'Bugünkü yapay zekâ isteklerinizi kullandınız. {time} saatinde yenileri kullanılabilir.',
  'error.budget_limit': 'Yapay zekâ bugün kullanılamıyor. {time} saatinde tekrar deneyin.',
  'error.burst_limit': 'Arka arkaya çok fazla istek gönderildi. Bir dakika bekleyip tekrar deneyin.',
  'error.provider_error': 'Yapay zekâ sağlayıcısı işlemi tamamlayamadı. Tekrar deneyin.',
  'error.cancelled': 'Metin gönderilmedi.',
  'limit.premium': 'Daha fazla günlük istek için Premium planlarına bakın.',
};
