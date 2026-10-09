import { useText } from '@factory/app';
import { SettingsButton } from '@factory/screens';
import { Stack } from 'expo-router';

import { text } from '@/text';

export function FeatureLayout() {
  const t = useText(text);

  return (
    <Stack screenOptions={{ headerRight: () => <SettingsButton /> }}>
      <Stack.Screen name="index" options={{ title: t('feature.title') }} />
    </Stack>
  );
}
