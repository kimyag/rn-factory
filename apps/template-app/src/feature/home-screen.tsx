import { useText } from '@factory/app';
import { createStyles, Screen, Text } from '@factory/ui';

import { text } from '@/text';

export function HomeScreen() {
  const t = useText(text);
  const styles = useStyles();

  return (
    <Screen style={styles.centered}>
      <Text>{t('feature.body')}</Text>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  centered: { alignItems: 'center', justifyContent: 'center' },
}));
