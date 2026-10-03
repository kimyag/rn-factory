import type { AppSettings } from '@factory/core';
import { createContext, use, type ReactNode } from 'react';

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppSettingsProvider({ settings, children }: { settings: AppSettings; children: ReactNode }) {
  return <AppSettingsContext value={settings}>{children}</AppSettingsContext>;
}

export function useAppSettings(): AppSettings {
  const settings = use(AppSettingsContext);
  if (!settings) {
    throw new Error('useAppSettings must be used inside FactoryProvider');
  }
  return settings;
}
