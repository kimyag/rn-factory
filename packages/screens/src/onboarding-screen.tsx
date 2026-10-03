import { useAppSettings, useOnboarding, useTelemetry, useText } from '@factory/app';
import { needsAnalyticsChoice } from '@factory/core/telemetry';
import { Button, createStyles, Mark, Screen, Text, useTheme } from '@factory/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { text } from './text/index.ts';

export function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { motion } = useTheme();
  const t = useText(text);
  const styles = useStyles();
  const [finishing, setFinishing] = useState(false);
  const [asking, setAsking] = useState(false);
  const settings = useAppSettings();
  const { choice, setChoice, track } = useTelemetry();

  function onContinue() {
    if (needsAnalyticsChoice(settings.modules.analytics, choice)) {
      setAsking(true);
      return;
    }
    finish();
  }

  function finish() {
    setFinishing(true);
    void track('onboarding_completed');
    setTimeout(complete, motion.achieve);
  }

  function choose(value: boolean) {
    setChoice(value);
    finish();
  }

  return (
    <Screen style={styles.centered}>
      <Mark state={finishing ? 'complete' : 'active'} />
      <Text variant="title">{t('onboarding.title')}</Text>
      {asking ? (
        <>
          <Text>{t('analytics.explanation')}</Text>
          <View style={styles.choices}>
            <Button variant="secondary" style={styles.choice} title={t('analytics.share')} onPress={() => choose(true)} disabled={finishing} />
            <Button variant="secondary" style={styles.choice} title={t('analytics.dontShare')} onPress={() => choose(false)} disabled={finishing} />
          </View>
        </>
      ) : (
        <Button title={t('onboarding.continue')} onPress={onContinue} disabled={finishing} />
      )}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  centered: { alignItems: 'center', justifyContent: 'center' },
  choices: { alignSelf: 'stretch', gap: theme.spacing.gapWide },
  choice: { alignSelf: 'stretch' },
}));
