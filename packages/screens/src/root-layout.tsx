import { Stack } from 'expo-router';

import { OnboardingProvider, useOnboarding } from './onboarding-state.tsx';

export function RootLayout() {
  return (
    <OnboardingProvider>
      <RootStack />
    </OnboardingProvider>
  );
}

function RootStack() {
  const { completed } = useOnboarding();

  return (
    <Stack>
      <Stack.Protected guard={!completed}>
        <Stack.Screen name="(onboarding)/onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={completed}>
        <Stack.Screen name="(feature)" options={{ headerShown: false }} />
        <Stack.Screen name="(settings)/settings" options={{ title: 'Settings' }} />
      </Stack.Protected>
    </Stack>
  );
}
