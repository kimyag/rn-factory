import { StyleSheet } from 'react-native';

import type { Theme } from './theme.ts';
import { useTheme } from './theme-provider.tsx';

export function createStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  const sheets = new WeakMap<Theme, T>();

  return function useStyles() {
    const theme = useTheme();
    const cached = sheets.get(theme);
    if (cached) {
      return cached;
    }
    const sheet = StyleSheet.create(factory(theme));
    sheets.set(theme, sheet);
    return sheet;
  };
}
