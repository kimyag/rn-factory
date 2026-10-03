import { storedValue } from '@factory/core/storage';
import { createTelemetry, telemetryStorage, type AnalyticsChoice, type ProductEvent, type Telemetry } from '@factory/core/telemetry';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { useAppSettings } from './app-settings.tsx';

const storedChoice = storedValue({ key: 'analytics.choice', schema: z.boolean().nullable(), fallback: null });
const storedPosthog = storedValue({ key: 'analytics.posthog', schema: z.record(z.string(), z.string()), fallback: {} });
type TelemetryState = {
  choice: AnalyticsChoice;
  setChoice: (value: boolean) => void;
  track: (event: ProductEvent) => Promise<void>;
  reportCrash: Telemetry['reportCrash'];
};
const TelemetryContext = createContext<TelemetryState | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const settings = useAppSettings();
  const [choice, updateChoice] = useState(() => storedChoice.get());
  const [telemetry] = useState(() => createTelemetry(settings, telemetryStorage(storedPosthog)));
  const lifecycle = useRef({ revision: 0 });

  useEffect(() => {
    const lifetime = lifecycle.current;
    const setup = ++lifetime.revision;
    telemetry.setAnalyticsChoice(storedChoice.get());
    void telemetry.start();
    return () => {
      // Strict Mode's immediate second setup keeps the same controller alive.
      queueMicrotask(() => { if (lifetime.revision === setup) telemetry.dispose(); });
    };
  }, [telemetry]);

  function setChoice(value: boolean) {
    telemetry.setAnalyticsChoice(value);
    storedChoice.set(value);
    updateChoice(value);
  }

  return (
    <TelemetryContext value={{
      choice, setChoice,
      track: telemetry.track,
      reportCrash: telemetry.reportCrash,
    }}>
      {children}
    </TelemetryContext>
  );
}

export function useTelemetry(): TelemetryState {
  const state = use(TelemetryContext);
  if (!state) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return state;
}
