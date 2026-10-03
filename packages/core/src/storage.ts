// SQLite backs localStorage on iOS and Android; the web build uses storage.web.ts instead.
import 'expo-sqlite/localStorage/install';

export { storedValue } from './stored-value.ts';
export type { StoredValue, StoredValueOptions } from './stored-value.ts';
