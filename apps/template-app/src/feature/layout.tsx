import { SettingsButton } from '@factory/screens';
import { Stack } from 'expo-router';

export function FeatureLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <SettingsButton /> }}>
      <Stack.Screen name="index" options={{ title: 'Feature' }} />
    </Stack>
  );
}
