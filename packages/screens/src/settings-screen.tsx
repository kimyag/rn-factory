import { useText } from '@factory/app';
import { Button, createStyles, Screen, Text, useThemeMode, type ThemeMode } from '@factory/ui';
import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import type { en } from './text/en.ts';
import { text } from './text/index.ts';

const modes: { mode: ThemeMode; label: keyof typeof en }[] = [
  { mode: 'system', label: 'settings.appearance.system' },
  { mode: 'light', label: 'settings.appearance.light' },
  { mode: 'dark', label: 'settings.appearance.dark' },
];

export function SettingsScreen() {
  const { mode, setMode } = useThemeMode();
  const t = useText(text);
  const styles = useStyles();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Text>{t('settings.comingSoon')}</Text>
      <View style={styles.row}>
        {modes.map((option) => (
          <Button
            key={option.mode}
            title={t(option.label)}
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
  const t = useText(text);
  const styles = useStyles();

  return (
    <Link href="/settings" style={styles.link}>
      {t('settings.title')}
    </Link>
  );
}

const useStyles = createStyles((theme) => ({
  row: { flexDirection: 'row', gap: theme.spacing.gap },
  link: { ...theme.type.body, color: theme.colors.ink },
}));
