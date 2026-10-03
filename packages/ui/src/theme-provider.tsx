import type { ColorScheme } from '@factory/core';
import { storedValue } from '@factory/core/storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { z } from 'zod';

import { getTheme, type Theme, type ThemeSettings } from './theme.ts';

export type ThemeMode = 'system' | ColorScheme;

type ThemeState = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const storedMode = storedValue({
  key: 'theme.mode',
  schema: z.enum(['system', 'light', 'dark']),
  fallback: 'system',
});

export function ThemeProvider({ settings, children }: { settings: ThemeSettings; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => storedMode.get());
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    }
  }, [mode]);

  function setMode(next: ThemeMode) {
    storedMode.set(next);
    setModeState(next);
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
