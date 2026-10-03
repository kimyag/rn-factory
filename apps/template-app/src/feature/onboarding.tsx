import { useText } from '@factory/app';
import { OnboardingScreen } from '@factory/screens';

import { text } from '@/text';

export function Onboarding() {
  const t = useText(text);

  return (
    <OnboardingScreen
      pages={[
        { title: t('onboarding.1.title'), body: t('onboarding.1.body') },
        { title: t('onboarding.2.title'), body: t('onboarding.2.body') },
        { title: t('onboarding.3.title'), body: t('onboarding.3.body') },
      ]}
    />
  );
}
