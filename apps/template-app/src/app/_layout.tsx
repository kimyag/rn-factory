import { FactoryProvider, useOnboarding, type FontFiles } from '@factory/app';
import { RouteErrorBoundary } from '@factory/screens';
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
    <Stack
      layout={({ state, navigation, children }) => (
        <RouteErrorBoundary
          recoveryKey={state.routes[state.index]?.key ?? ''}
          onGoToStart={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: completed ? '(feature)' : '(onboarding)/onboarding' }],
            })
          }
        >
          {children}
        </RouteErrorBoundary>
      )}
    >
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
