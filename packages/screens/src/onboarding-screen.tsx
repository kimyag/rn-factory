import { useOnboarding, useText } from '@factory/app';
import { Button, createStyles, Mark, Screen, Text, useTheme } from '@factory/ui';
import { useState } from 'react';

import { text } from './text/index.ts';

export function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { motion } = useTheme();
  const t = useText(text);
  const styles = useStyles();
  const [finishing, setFinishing] = useState(false);

  function onContinue() {
    setFinishing(true);
    setTimeout(complete, motion.achieve);
  }

  return (
    <Screen style={styles.centered}>
      <Mark state={finishing ? 'complete' : 'active'} />
      <Text variant="title">{t('onboarding.title')}</Text>
      <Button title={t('onboarding.continue')} onPress={onContinue} disabled={finishing} />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  centered: { alignItems: 'center', justifyContent: 'center' },
}));
