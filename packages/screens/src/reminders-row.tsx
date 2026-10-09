import { useText } from '@factory/app';
import { requestReminderPermission, scheduleReminder } from '@factory/reminders';
import { reminderSettingsSchema } from '@factory/core';
import { storedValue } from '@factory/core/storage';
import { createStyles, Text, useTheme } from '@factory/ui';
import { useRef, useState } from 'react';
import { Linking, Pressable, Switch, TextInput, View } from 'react-native';

import { text } from './text/index.ts';
import { defaultReminderSettings, disableReminder, migrateReminderSettings, reminderSwitchIsOn } from './reminder-switch-state.ts';
import { cancelSettingsReminder, refreshReminderOsState, settingsReminderKey, useReminderOsState } from './use-reminder-os-state.ts';

const reminderSettings = storedValue({
  key: 'reminders.settings',
  schema: reminderSettingsSchema,
  version: 2,
  migrate: migrateReminderSettings,
  fallback: defaultReminderSettings,
});

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
type ReminderError = 'reminders.denied' | 'reminders.failed' | 'reminders.invalidTime';

function readReminderSettings() {
  const settings = reminderSettings.get();
  if (typeof localStorage !== 'undefined') {
    reminderSettings.set(settings);
  }
  return settings;
}

export function RemindersRow() {
  const t = useText(text);
  const theme = useTheme();
  const styles = useStyles();
  const [settings, setSettings] = useState(readReminderSettings);
  const [draftTime, setDraftTime] = useState(settings.time);
  const reminderOsState = useReminderOsState();
  const [error, setError] = useState<ReminderError | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const switchOn = reminderSwitchIsOn(
    settings.wantsReminders,
    reminderOsState.permissionGranted,
    reminderOsState.scheduled,
  );
  const visibleError = settings.wantsReminders && reminderOsState.permissionGranted === false
    ? 'reminders.denied'
    : error === 'reminders.denied' && reminderOsState.permissionGranted === true ? null : error;

  function save(next: typeof settings) {
    setSettings(next);
    reminderSettings.set(next);
  }

  async function enable() {
    if (busyRef.current) {
      return;
    }
    const current = settings;
    if (!timePattern.test(draftTime)) {
      setError('reminders.invalidTime');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await requestReminderPermission(t('reminders.title'));
      const permissionState = await refreshReminderOsState();
      if (permissionState.permissionGranted !== true) {
        setError(permissionState.permissionGranted === false ? 'reminders.denied' : 'reminders.failed');
        return;
      }
      await cancelSettingsReminder();
      const [hour, minute] = draftTime.split(':').map(Number);
      await scheduleReminder({
        title: t('reminders.title'),
        body: t('reminders.explanation'),
        trigger: { type: 'daily', hour: hour ?? 9, minute: minute ?? 0 },
        key: settingsReminderKey,
      });
      save({ ...current, wantsReminders: true, time: draftTime });
      await refreshReminderOsState();
    } catch {
      setError('reminders.failed');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function disable() {
    if (busyRef.current) {
      return;
    }
    const current = settings;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await disableReminder(current, cancelSettingsReminder, save);
      await refreshReminderOsState();
    } catch {
      setError('reminders.failed');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function updateTime(time: string) {
    if (busyRef.current) {
      return;
    }
    setDraftTime(time);
    const current = settings;
    if (!current.wantsReminders) {
      if (!timePattern.test(time)) {
        setError('reminders.invalidTime');
        return;
      }
      setError(null);
      save({ ...current, time });
      return;
    }
    if (!timePattern.test(time)) {
      setError('reminders.invalidTime');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const [hour, minute] = time.split(':').map(Number);
      await cancelSettingsReminder();
      await scheduleReminder({
        title: t('reminders.title'),
        body: t('reminders.explanation'),
        trigger: { type: 'daily', hour: hour ?? 9, minute: minute ?? 0 },
        key: settingsReminderKey,
      });
      save({ ...current, time });
      await refreshReminderOsState();
    } catch {
      setError('reminders.failed');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <View style={styles.section}>
      <Text testID="reminders-title" variant="caption" accessibilityRole="header">{t('reminders.title')}</Text>
      <Text>{t('reminders.explanation')}</Text>
      <View style={styles.row}>
        <Text>{t('reminders.time')}</Text>
        <TextInput
          accessibilityLabel={t('reminders.time')}
          editable={!busy}
          keyboardType="numbers-and-punctuation"
          onChangeText={(time) => {
            setDraftTime(time);
            setError(null);
          }}
          onEndEditing={({ nativeEvent }) => void updateTime(nativeEvent.text)}
          placeholder={t('reminders.timePlaceholder')}
          returnKeyType="done"
          style={styles.input}
          value={draftTime}
        />
      </View>
      <View style={styles.row}>
        <Text>{t('reminders.enabled')}</Text>
        <Switch
          accessibilityLabel={t('reminders.enabled')}
          testID="reminders-enabled"
          disabled={busy}
          value={switchOn}
          onValueChange={(enabled) => void (enabled ? enable() : disable())}
          trackColor={{ false: theme.colors.inkMuted, true: theme.colors.ink }}
          thumbColor={theme.colors.paper}
          ios_backgroundColor={theme.colors.inkMuted}
        />
      </View>
      {visibleError !== null && <Text testID={visibleError === 'reminders.denied' ? 'reminders-permission-denied' : undefined} variant="caption">{t(visibleError)}</Text>}
      {visibleError === 'reminders.denied' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings().catch(() => undefined)}
          style={styles.settingsAction}
          testID="reminders-open-settings"
        >
          <Text>{t('reminders.openSettings')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  section: { gap: theme.spacing.gapWide },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.gap },
  settingsAction: { minHeight: theme.spacing.edge * 3, justifyContent: 'center' },
  input: {
    minWidth: 88,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.inkMuted,
    borderRadius: theme.radius.corner,
    color: theme.colors.ink,
    paddingHorizontal: theme.spacing.gap,
    textAlign: 'center',
  },
}));
