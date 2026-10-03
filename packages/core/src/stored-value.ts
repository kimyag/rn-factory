import { z } from 'zod';

export type StoredValue<T> = {
  get: () => T;
  set: (value: T) => void;
};

export type StoredValueOptions<Schema extends z.ZodType> = {
  /** Unique across the app, e.g. `'theme.mode'`. */
  key: string;
  /** Checks the stored data on every read. */
  schema: Schema;
  /** Returned when nothing valid is stored. */
  fallback: z.output<Schema>;
  /** Raise by 1 when the shape changes, and convert older data in `migrate`. Default 1. */
  version?: number;
  /** Converts data saved by an older `version` to the current shape. */
  migrate?: (value: unknown, fromVersion: number) => unknown;
};

const envelopeSchema = z.object({ version: z.number().int().positive(), value: z.unknown() });

/**
 * A typed value that survives a restart. Define it once at module scope and
 * read it with `get()`, which is synchronous, e.g. in a `useState` initializer.
 * Invalid data, and data from a newer `version`, read as `fallback`.
 */
export function storedValue<Schema extends z.ZodType>({
  key,
  schema,
  fallback,
  version = 1,
  migrate,
}: StoredValueOptions<Schema>): StoredValue<z.output<Schema>> {
  return {
    get() {
      // localStorage is missing only while the web build renders on the server.
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
      if (raw === null) {
        return fallback;
      }
      try {
        const stored = envelopeSchema.parse(JSON.parse(raw));
        if (stored.version === version) {
          return schema.parse(stored.value);
        }
        if (stored.version < version && migrate) {
          return schema.parse(migrate(stored.value, stored.version));
        }
      } catch {
        // Unreadable data and failed migrations count as nothing stored.
      }
      return fallback;
    },
    set(value) {
      localStorage.setItem(key, JSON.stringify({ version, value }));
    },
  };
}
