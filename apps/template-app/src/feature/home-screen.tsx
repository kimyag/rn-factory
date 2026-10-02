import { createStyles, Screen, Text } from '@factory/ui';

export function HomeScreen() {
  const styles = useStyles();

  return (
    <Screen style={styles.centered}>
      <Text>Feature screen</Text>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  centered: { alignItems: 'center', justifyContent: 'center' },
}));
