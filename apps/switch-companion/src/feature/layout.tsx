import { useText } from '@factory/app';
import { SettingsButton } from '@factory/screens';
import { Link, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text, createStyles } from '@factory/ui';

import { text } from '@/text';

export function FeatureLayout() {
  const t = useText(text);
  const styles = useStyles();

  return (
    <Stack screenOptions={{ headerRight: () => (
      <View style={styles.headerActions}>
        <Link href="/(feature)/loose-ends" asChild>
          <Pressable testID="loose-ends-open" accessibilityRole="button" hitSlop={8}>
            <Text>{t('looseEnds.open')}</Text>
          </Pressable>
        </Link>
        <SettingsButton />
      </View>
    ) }}>
      <Stack.Screen name="index" options={{ title: t('feature.title') }} />
      <Stack.Screen name="loose-ends" options={{ title: t('looseEnds.title') }} />
      <Stack.Screen name="perf-seed" options={{ headerShown: false }} />
    </Stack>
  );
}

const useStyles = createStyles((theme) => ({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gapWide },
}));
