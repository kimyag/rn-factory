import { Button, StyleSheet, Text, View } from 'react-native';

import { useOnboarding } from './onboarding-state.tsx';

export function OnboardingScreen() {
  const { complete } = useOnboarding();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">Onboarding</Text>
      <Button title="Continue" onPress={complete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
