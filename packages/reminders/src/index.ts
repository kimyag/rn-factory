import { Platform } from 'react-native';

export type ReminderTrigger = { type: 'date'; date: Date } | { type: 'daily'; hour: number; minute: number };

export type ReminderInput = {
  title: string;
  body: string;
  trigger: ReminderTrigger;
  key?: string;
};

export type ScheduledReminder = {
  id: string;
  key: string;
  title: string | null;
  body: string | null;
};

export async function hasReminderPermission(): Promise<boolean> {
  const notifications = await import('expo-notifications');
  const current = await notifications.getPermissionsAsync();
  return current.granted || current.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

const identifierPrefix = 'factory-reminders:';

function identifierFor(key?: string): string {
  const identity = key ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${identifierPrefix}${identity}`;
}

export async function requestReminderPermission(channelName: string): Promise<boolean> {
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('reminders', {
      name: channelName,
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return requested.granted || requested.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleReminder(reminder: ReminderInput): Promise<string> {
  const notifications = await import('expo-notifications');
  const channelId = Platform.OS === 'android' ? 'reminders' : undefined;
  const trigger: import('expo-notifications').NotificationTriggerInput = reminder.trigger.type === 'date'
    ? { type: notifications.SchedulableTriggerInputTypes.DATE, date: reminder.trigger.date, channelId }
    : {
        type: notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.trigger.hour,
        minute: reminder.trigger.minute,
        channelId,
      };
  return notifications.scheduleNotificationAsync({
    identifier: identifierFor(reminder.key),
    content: { title: reminder.title, body: reminder.body },
    trigger,
  });
}

export async function cancelReminder(id: string): Promise<void> {
  const notifications = await import('expo-notifications');
  await notifications.cancelScheduledNotificationAsync(id);
}

export async function listReminders(): Promise<ScheduledReminder[]> {
  const notifications = await import('expo-notifications');
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(({ identifier }) => identifier.startsWith(identifierPrefix)).map(({ identifier, content }) => ({
    id: identifier,
    key: identifier.slice(identifierPrefix.length),
    title: content.title ?? null,
    body: content.body ?? null,
  }));
}
