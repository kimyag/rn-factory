import {
  languageCodes,
  languages,
  useAppSettings,
  useLanguage,
  useText,
  useTelemetry,
  type LanguageChoice,
} from '@factory/app';
import { isPlaceholder, type AppSettings } from '@factory/core';
import { PremiumSummary, usePremium, useRestore } from '@factory/payments';
import { createStyles, Mark, Screen, Text, useTheme, useThemeMode, type ThemeMode } from '@factory/ui';
import Constants from 'expo-constants';
import { Link, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform, Pressable, StyleSheet, Switch, View, type AccessibilityRole } from 'react-native';
import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';

import { text } from './text/index.ts';

type Option<T extends string> = { value: T; label: string };

const RemindersRow = lazy(() => import('./reminders-row.tsx').then(({ RemindersRow: Component }) => ({ default: Component })));

export function SettingsScreen() {
  const t = useText(text);
  const settings = useAppSettings();
  const { mode, setMode } = useThemeMode();
  const { choice, setChoice } = useLanguage();
  const styles = useStyles();
  const theme = useTheme();
  const analytics = useTelemetry();
  const premium = usePremium();
  const restoring = useRestore();

  const themeOptions: Option<ThemeMode>[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];
  const languageOptions: Option<LanguageChoice>[] = [
    { value: 'system', label: t('settings.language.system') },
    ...languageCodes.map((code) => ({ value: code, label: languages[code].name })),
  ];
  const version = Constants.expoConfig?.version ?? '';

  function rate() {
    const url = reviewUrl(settings);
    if (url) {
      void Linking.openURL(url);
    }
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Section title={t('settings.theme')}>
        <ChoiceGroup idPrefix="theme" options={themeOptions} selected={mode} onSelect={(value) => {
          setMode(value);
          void analytics.track('theme_changed');
        }} />
      </Section>
      <Section title={t('settings.language')}>
        <ChoiceGroup idPrefix="language" options={languageOptions} selected={choice} onSelect={(value) => {
          setChoice(value);
          void analytics.track('language_changed');
        }} />
      </Section>
      {settings.modules.analytics && (
        <Section title={t('analytics.title')}>
          <Text>{t('analytics.explanation')}</Text>
          <View style={styles.row}>
            <Text>{t('analytics.share')}</Text>
            <Switch
              accessibilityLabel={t('analytics.share')}
              value={analytics.choice === true}
              onValueChange={analytics.setChoice}
              trackColor={{ false: theme.colors.inkMuted, true: theme.colors.ink }}
              thumbColor={theme.colors.paper}
              ios_backgroundColor={theme.colors.inkMuted}
            />
          </View>
        </Section>
      )}
      {settings.modules.reminders && (
        <Suspense fallback={null}>
          <RemindersRow />
        </Suspense>
      )}
      {premium.available && (
        <Section title={t('settings.premium')}>
          {premium.status === 'inactive' && (
            <ActionRow
              testID="premium-plans"
              label={t('settings.premium.plans')}
              role="button"
              onPress={premium.openPaywall}
            />
          )}
          {premium.status === 'active' && (
            <View style={styles.row}>
              <Text testID="premium-active">{t('settings.premium.active')}</Text>
            </View>
          )}
          {premium.status === 'active' && <PremiumSummary />}
          {premium.status === 'active' && premium.details?.expires !== null && (
            <ActionRow label={t('settings.premium.manage')} role="link" onPress={() => void premium.manage()} />
          )}
          <ActionRow testID="restore" label={restoring.label} role="button" onPress={restoring.restore} />
          {restoring.message !== null && (
            <Text testID="restore-result" variant="caption">
              {restoring.message}
            </Text>
          )}
          {restoring.hint !== null && <Text variant="caption">{restoring.hint}</Text>}
        </Section>
      )}
      <Section title={t('settings.about')}>
        <ActionRow
          label={t('settings.privacy')}
          role="link"
          onPress={() => void WebBrowser.openBrowserAsync(settings.privacyUrl)}
        />
        <ActionRow
          label={t('settings.contact')}
          role="link"
          onPress={() => void Linking.openURL(`mailto:${settings.contactEmail}`)}
        />
        <ActionRow label={t('settings.rate')} role="link" onPress={rate} />
        <View style={styles.row} accessible accessibilityLabel={`${t('settings.version')}, ${version}`}>
          <Text>{t('settings.version')}</Text>
          <Text variant="mono">{version}</Text>
        </View>
      </Section>
    </Screen>
  );
}

// iOS needs the App Store app ID, a placeholder until #14; Android uses the package name.
function reviewUrl(settings: AppSettings): string | null {
  if (Platform.OS === 'ios') {
    const { ascAppId } = settings.stores.apple;
    return isPlaceholder(ascAppId) ? null : `https://apps.apple.com/app/id${ascAppId}?action=write-review`;
  }
  return `https://play.google.com/store/apps/details?id=${settings.bundleIds.android}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <Text variant="caption" accessibilityRole="header">
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function ChoiceGroup<T extends string>({
  idPrefix,
  options,
  selected,
  onSelect,
}: {
  idPrefix: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const styles = useStyles();

  return (
    <View accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            testID={`${idPrefix}-${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text>{option.label}</Text>
            <Mark state={isSelected ? 'active' : 'empty'} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionRow({
  label,
  role,
  onPress,
  testID,
}: {
  label: string;
  role: AccessibilityRole;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();

  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

export function SettingsButton() {
  const t = useText(text);
  const styles = useStyles();

  return (
    <Link testID="settings-open" href="/settings" style={styles.link}>
      {t('settings.title')}
    </Link>
  );
}

const useStyles = createStyles((theme) => ({
  section: { gap: theme.spacing.gap },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.gapWide,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  pressed: { opacity: theme.motion.pressedOpacity },
  link: { ...theme.type.body, color: theme.colors.ink },
}));
