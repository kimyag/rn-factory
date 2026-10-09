import { useText } from '@factory/app';
import { cancelReminder, hasReminderPermission, listReminders, requestReminderPermission, scheduleReminder } from '@factory/reminders';
import { reminderSettingsSchema } from '@factory/core';
import { storedValue } from '@factory/core/storage';
import { createStyles, Text, useTheme } from '@factory/ui';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Switch, TextInput, View } from 'react-native';

import { text } from './text/index.ts';
import { defaultReminderSettings, reminderSwitchIsOn } from './reminder-switch-state.ts';

const reminderSettings = storedValue({
  key: 'reminders.settings',
  schema: reminderSettingsSchema,
  fallback: defaultReminderSettings,
});

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
type ReminderError = 'reminders.denied' | 'reminders.failed' | 'reminders.invalidTime';

export function RemindersRow() {
  const t = useText(text);
  const theme = useTheme();
  const styles = useStyles();
  const [settings, setSettings] = useState(reminderSettings.get);
  const settingsRef = useRef(settings);
  const [draftTime, setDraftTime] = useState(settings.time);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [reminderScheduled, setReminderScheduled] = useState(false);
  const [error, setError] = useState<ReminderError | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const switchOn = reminderSwitchIsOn(settings.enabled, permissionGranted, reminderScheduled);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const [permitted, scheduledReminders] = await Promise.all([
        hasReminderPermission().catch(() => false),
        listReminders().catch(() => []),
      ]);
      if (!mounted) {
        return;
      }
      setPermissionGranted(permitted);
      const current = settingsRef.current;
      setReminderScheduled(current.id !== null && scheduledReminders.some(({ id }) => id === current.id));
      setError((previous) => current.enabled && !permitted
        ? 'reminders.denied'
        : previous === 'reminders.denied' ? null : previous);
    }
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  function save(next: typeof settings) {
    settingsRef.current = next;
    setSettings(next);
    reminderSettings.set(next);
  }

  async function enable() {
    if (busyRef.current) {
      return;
    }
    const current = settingsRef.current;
    if (!timePattern.test(draftTime)) {
      setError('reminders.invalidTime');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const permitted = await requestReminderPermission(t('reminders.title'));
      if (!permitted) {
        setPermissionGranted(false);
        setError('reminders.denied');
        return;
      }
      setPermissionGranted(true);
      const [hour, minute] = draftTime.split(':').map(Number);
      const id = await scheduleReminder({
        title: t('reminders.title'),
        body: t('reminders.explanation'),
        trigger: { type: 'daily', hour: hour ?? 9, minute: minute ?? 0 },
      });
      save({ ...current, enabled: true, time: draftTime, id });
      setReminderScheduled(true);
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
    const current = settingsRef.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (current.id) {
        await cancelReminder(current.id);
      }
      save({ ...current, enabled: false, id: null });
      setReminderScheduled(false);
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
    const current = settingsRef.current;
    if (!current.enabled) {
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
      const id = await scheduleReminder({
        title: t('reminders.title'),
        body: t('reminders.explanation'),
        trigger: { type: 'daily', hour: hour ?? 9, minute: minute ?? 0 },
      });
      if (current.id) {
        try {
          await cancelReminder(current.id);
        } catch (cause) {
          await cancelReminder(id);
          throw cause;
        }
      }
      save({ ...current, time, id });
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
      {error !== null && <Text testID={error === 'reminders.denied' ? 'reminders-permission-denied' : undefined} variant="caption">{t(error)}</Text>}
      {error === 'reminders.denied' && (
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
