import { FactoryProvider, useOnboarding, type FontFiles } from '@factory/app';
import { Stack } from 'expo-router';

import settings from '../../app.settings.ts';

const fontFiles: FontFiles = {
  title: require('../../assets/fonts/Newsreader28pt-Medium.ttf'),
  mono: require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
};

export default function RootLayout() {
  return (
    <FactoryProvider settings={settings} fontFiles={fontFiles}>
      <AppStack />
    </FactoryProvider>
  );
}

function AppStack() {
  const { completed } = useOnboarding();

  return (
    <Stack>
      <Stack.Protected guard={!completed}>
        <Stack.Screen name="(onboarding)/onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={completed}>
        <Stack.Screen name="(feature)" options={{ headerShown: false }} />
        <Stack.Screen name="(settings)/settings" />
      </Stack.Protected>
    </Stack>
  );
}
