import type { ColorScheme } from '@factory/core';
import { createContext, use, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { getTheme, type Theme, type ThemeSettings } from './theme.ts';

export type ThemeMode = 'system' | ColorScheme;

type ThemeState = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

// The mode is in memory until local storage (#6) persists it.
export function ThemeProvider({ settings, children }: { settings: ThemeSettings; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  function setMode(next: ThemeMode) {
    setModeState(next);
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
    }
  }

  return (
    <ThemeContext value={{ theme: getTheme(settings, scheme), mode, setMode }}>
      {children}
    </ThemeContext>
  );
}

function useThemeState(): ThemeState {
  const state = use(ThemeContext);
  if (!state) {
    throw new Error('Theme hooks must be used inside ThemeProvider');
  }
  return state;
}

export function useTheme(): Theme {
  return useThemeState().theme;
}

export function useThemeMode(): Pick<ThemeState, 'mode' | 'setMode'> {
  const { mode, setMode } = useThemeState();
  return { mode, setMode };
}
