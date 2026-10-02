// SQLite backs localStorage on iOS and Android; the web uses the browser's own.
import 'expo-sqlite/localStorage/install';

export { storedValue } from './stored-value.ts';
export type { StoredValue, StoredValueOptions } from './stored-value.ts';
