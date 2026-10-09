import { useText } from '@factory/app';
import { PaywallScreen } from '@factory/payments';

import { text } from '@/text';

export function Paywall() {
  const t = useText(text);

  return <PaywallScreen title={t('paywall.title')} body={t('paywall.body')} />;
}
