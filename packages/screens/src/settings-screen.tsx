import { Button, createStyles, Screen, Text, useThemeMode, type ThemeMode } from '@factory/ui';
import { Link } from 'expo-router';
import { View } from 'react-native';

const modes: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const { mode, setMode } = useThemeMode();
  const styles = useStyles();

  return (
    <Screen>
      <Text>Settings come in #4.</Text>
      <View style={styles.row}>
        {modes.map((option) => (
          <Button
            key={option.mode}
            title={option.label}
            variant={option.mode === mode ? 'primary' : 'secondary'}
            selected={option.mode === mode}
            onPress={() => setMode(option.mode)}
          />
        ))}
      </View>
    </Screen>
  );
}

export function SettingsButton() {
  const styles = useStyles();

  return (
    <Link href="/settings" style={styles.link}>
      Settings
    </Link>
  );
}

const useStyles = createStyles((theme) => ({
  row: { flexDirection: 'row', gap: theme.spacing.gap },
  link: { ...theme.type.body, color: theme.colors.ink },
}));
