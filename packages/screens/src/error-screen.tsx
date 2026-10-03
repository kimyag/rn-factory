import { useText } from '@factory/app';
import { Button, createStyles, Screen, Text } from '@factory/ui';
import { View } from 'react-native';

import { text } from './text/index.ts';

type ErrorScreenProps = {
  showGoToStart: boolean;
  onRetry: () => void;
  onGoToStart: () => void;
};

export function ErrorScreen({ showGoToStart, onRetry, onGoToStart }: ErrorScreenProps) {
  const t = useText(text);
  const styles = useStyles();

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.message} accessibilityLiveRegion="polite">
        <Text variant="title">{t('error.title')}</Text>
        <Text>{t(showGoToStart ? 'error.repeated' : 'error.message')}</Text>
      </View>
      <Button title={t('error.retry')} onPress={onRetry} />
      {showGoToStart && (
        <Button title={t('error.goToStart')} variant="secondary" onPress={onGoToStart} />
      )}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  screen: { flexGrow: 1, justifyContent: 'center', gap: theme.spacing.gapWide },
  message: { gap: theme.spacing.gap },
}));
