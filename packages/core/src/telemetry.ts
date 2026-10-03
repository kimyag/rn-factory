import { isPlaceholder, type AppSettings } from './settings.ts';
export { telemetryStorage } from './telemetry-storage.ts';

export type AnalyticsChoice = boolean | null;
export type ProductEvent = 'onboarding_completed' | 'theme_changed' | 'language_changed';
export type TelemetryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  clear: () => void;
};
export type TelemetryVendors = {
  startCrashes: (dsn: string) => { capture: (error: Error) => void; close: () => Promise<void> };
  startAnalytics: (key: string, host: string, storage: TelemetryStorage, active: () => boolean) => {
    capture: (event: ProductEvent) => void;
    stop: () => void;
  };
};

export function needsAnalyticsChoice(enabled: boolean, choice: AnalyticsChoice): boolean {
  return enabled && choice === null;
}

export function telemetryCapabilities(settings: AppSettings) {
  return {
    crashes: settings.modules.crashReports && !isPlaceholder(settings.telemetry.sentryDsn),
    analytics: settings.modules.analytics && !isPlaceholder(settings.telemetry.posthogApiKey)
      && !isPlaceholder(settings.telemetry.posthogHost),
  };
}

export function createTelemetry(
  settings: AppSettings,
  storage: TelemetryStorage,
  load: () => Promise<TelemetryVendors> = () => import('./telemetry-vendors.ts'),
) {
  const capabilities = telemetryCapabilities(settings);
  let choice: AnalyticsChoice = null;
  let generation = 0;
  let disposed = false;
  let vendors: Promise<TelemetryVendors> | undefined;
  let crashes: ReturnType<TelemetryVendors['startCrashes']> | undefined;
  let crashStart: Promise<void> | undefined;
  let analytics: ReturnType<TelemetryVendors['startAnalytics']> | undefined;
  let analyticsStart: Promise<void> | undefined;

  function adapters() {
    vendors ??= load();
    return vendors;
  }

  function startCrashes() {
    if (!capabilities.crashes || disposed) return Promise.resolve();
    crashStart ??= adapters().then((adapter) => {
      if (!disposed) crashes = adapter.startCrashes(settings.telemetry.sentryDsn);
    }).catch(() => {});
    return crashStart;
  }

  function startAnalytics() {
    if (!capabilities.analytics || choice !== true || disposed) return Promise.resolve();
    const session = generation;
    const active = () => !disposed && choice === true && session === generation;
    analyticsStart ??= adapters().then((adapter) => {
      if (!active()) return;
      const guardedStorage: TelemetryStorage = {
        getItem: (key) => active() ? storage.getItem(key) : null,
        setItem: (key, value) => { if (active()) storage.setItem(key, value); },
        clear: () => { if (active()) storage.clear(); },
      };
      analytics = adapter.startAnalytics(
        settings.telemetry.posthogApiKey, settings.telemetry.posthogHost, guardedStorage, active,
      );
    }).catch(() => {});
    return analyticsStart;
  }

  return {
    start: startCrashes,
    setAnalyticsChoice(value: AnalyticsChoice) {
      if (choice !== value) {
        generation += 1;
        choice = value;
        analytics?.stop();
        analytics = undefined;
        analyticsStart = undefined;
      }
      if (value !== true || !capabilities.analytics) storage.clear();
      void startAnalytics();
    },
    async track(event: ProductEvent) {
      if (choice !== true || !capabilities.analytics || disposed) return;
      const session = generation;
      await startAnalytics();
      if (!disposed && choice === true && session === generation) {
        try { analytics?.capture(event); } catch {}
      }
    },
    async reportCrash(error: Error) {
      await startCrashes();
      if (!disposed) {
        try { crashes?.capture(error); } catch {}
      }
    },
    dispose() {
      disposed = true;
      generation += 1;
      analytics?.stop();
      analytics = undefined;
      // close only the crash SDK; analytics shutdown would flush withdrawn data.
      void crashes?.close().catch(() => {});
    },
  };
}

export type Telemetry = ReturnType<typeof createTelemetry>;
