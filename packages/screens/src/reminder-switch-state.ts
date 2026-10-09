export type ReminderStoredSettings = { wantsReminders: boolean; time: string };

export const defaultReminderSettings: ReminderStoredSettings = { wantsReminders: false, time: '09:00' };

export type ReminderOsState = { permissionGranted: boolean | null; scheduled: boolean | null };

export const unknownReminderOsState: ReminderOsState = { permissionGranted: null, scheduled: null };

export function reminderSwitchIsOn(wantsReminders: boolean, permissionGranted: boolean | null, scheduled: boolean | null): boolean {
  return wantsReminders && permissionGranted === true && scheduled === true;
}

export async function disableReminder(
  current: ReminderStoredSettings,
  cancel: () => Promise<void>,
  save: (next: ReminderStoredSettings) => void,
): Promise<void> {
  const disabled = { ...current, wantsReminders: false };
  save(disabled);
  await cancel();
}

let legacyReminderId: string | null = null;

export function migrateReminderSettings(value: unknown, fromVersion: number): unknown {
  if (fromVersion !== 1 || typeof value !== 'object' || value === null) {
    return value;
  }
  const previous = value as Record<string, unknown>;
  legacyReminderId = typeof previous.id === 'string' ? previous.id : null;
  return {
    wantsReminders: previous.enabled === true,
    time: typeof previous.time === 'string' ? previous.time : defaultReminderSettings.time,
  };
}

export function getLegacyReminderId(): string | null {
  return legacyReminderId;
}

export function clearLegacyReminderId(id: string): void {
  if (legacyReminderId === id) {
    legacyReminderId = null;
  }
}

export function createReminderOsStore(
  read: () => Promise<ReminderOsState>,
  subscribeToForeground: (onForeground: () => void) => () => void,
) {
  let snapshot = unknownReminderOsState;
  let requestNumber = 0;
  const listeners = new Set<() => void>();
  let unsubscribeFromForeground: (() => void) | null = null;

  async function refresh(): Promise<ReminderOsState> {
    const currentRequest = ++requestNumber;
    let next: ReminderOsState;
    try {
      next = await read();
    } catch {
      next = unknownReminderOsState;
    }
    if (currentRequest !== requestNumber) {
      return snapshot;
    }
    if (snapshot.permissionGranted === next.permissionGranted && snapshot.scheduled === next.scheduled) {
      return snapshot;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
    return snapshot;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (listeners.size === 1) {
      unsubscribeFromForeground = subscribeToForeground(() => void refresh());
      void refresh();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        unsubscribeFromForeground?.();
        unsubscribeFromForeground = null;
      }
    };
  }

  return {
    getSnapshot: () => snapshot,
    refresh,
    subscribe,
  };
}
