import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text>Settings come in #4.</Text>
    </View>
  );
}

export function SettingsButton() {
  return <Link href="/settings">Settings</Link>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
