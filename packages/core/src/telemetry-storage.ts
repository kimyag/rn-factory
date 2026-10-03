import type { TelemetryStorage } from './telemetry.ts';

type StorageValue = { get: () => Record<string, string>; set: (value: Record<string, string>) => void };

export function telemetryStorage(value: StorageValue): TelemetryStorage {
  return {
    getItem: (key) => value.get()[key] ?? null,
    setItem: (key, item) => value.set({ ...value.get(), [key]: item }),
    clear: () => value.set({}),
  };
}
