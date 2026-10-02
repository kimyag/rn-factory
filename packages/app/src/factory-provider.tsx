import type { AppSettings } from '@factory/core';
import { ThemeProvider, useTheme, type Theme } from '@factory/ui';
import { useFonts, type FontSource } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { LanguageProvider } from './language-state.tsx';
import { OnboardingProvider } from './onboarding-state.tsx';

void SplashScreen.preventAutoHideAsync();

export type FontFiles = Partial<Record<keyof AppSettings['fonts'], FontSource>>;

type FactoryProviderProps = {
  settings: AppSettings;
  fontFiles?: FontFiles;
  children: ReactNode;
};

export function FactoryProvider({ settings, fontFiles = {}, children }: FactoryProviderProps) {
  const [fontsLoaded, fontError] = useFonts(fontsToLoad(settings, fontFiles));
  const ready = fontsLoaded || fontError !== null;

  // The providers below read stored values synchronously on their first render,
  // and their effects (Appearance) run before this one, so the splash hides
  // only after the stored theme and onboarding state are in place.
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <LanguageProvider>
      <ThemeProvider settings={settings}>
        <NavigationTheme>
          <OnboardingProvider>{children}</OnboardingProvider>
        </NavigationTheme>
      </ThemeProvider>
    </LanguageProvider>
  );
}

// Native builds embed the fonts with the expo-font config plugin; loading them
// here as well makes them work in Expo Go and on the web.
function fontsToLoad(settings: AppSettings, files: FontFiles): Record<string, FontSource> {
  const fonts: Record<string, FontSource> = {};
  for (const role of ['title', 'mono'] as const) {
    const font = settings.fonts[role];
    const file = files[role];
    if (font !== 'system' && file !== undefined) {
      fonts[font.family] = file;
    }
  }
  return fonts;
}

function NavigationTheme({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </NavigationThemeProvider>
  );
}

const navigationThemes = new WeakMap<Theme, typeof DefaultTheme>();

function navigationTheme(theme: Theme): typeof DefaultTheme {
  const cached = navigationThemes.get(theme);
  if (cached) {
    return cached;
  }
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const { ink, paper, line } = theme.colors;
  const value = {
    ...base,
    dark: theme.scheme === 'dark',
    colors: { primary: ink, background: paper, card: paper, text: ink, border: line, notification: ink },
  };
  navigationThemes.set(theme, value);
  return value;
}
