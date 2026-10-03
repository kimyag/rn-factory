// The web uses the browser's own localStorage, so expo-sqlite (and its web worker) is not loaded.
export { storedValue } from './stored-value.ts';
export type { StoredValue, StoredValueOptions } from './stored-value.ts';
