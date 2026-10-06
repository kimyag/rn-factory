import * as Sentry from '@sentry/react-native';
import { PostHog } from 'posthog-react-native';

import { consentRequest } from './telemetry-network.ts';
import { sanitizeCrashEvent } from './crash-data.ts';
import type { TelemetryVendors } from './telemetry.ts';

export const startCrashes: TelemetryVendors['startCrashes'] = (dsn) => {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    enableAutoSessionTracking: false,
    enableNativeNagger: false,
    enableLogs: false,
    enableAppHangTracking: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    enableStallTracking: false,
    enableUserInteractionTracing: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0,
    autoInitializeNativeSdk: true,
    beforeSend: sanitizeCrashEvent,
  });
  return { capture: (error) => { Sentry.captureException(error); }, close: async () => { await Sentry.close(); } };
};

export const startAnalytics: TelemetryVendors['startAnalytics'] = (key, host, storage, active) => {
  class ConsentedPostHog extends PostHog {
    override fetch(...args: Parameters<PostHog['fetch']>): ReturnType<PostHog['fetch']> {
      return consentRequest(active, () => super.fetch(...args), {
        status: 200,
        text: async () => '',
        json: async () => ({}),
      });
    }
  }
  const client = new ConsentedPostHog(key, {
    host,
    persistence: 'file',
    customStorage: storage,
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    errorTracking: { autocapture: false, exceptionSteps: { enabled: false } },
    disableGeoip: true,
    disableRemoteConfig: true,
    disableRemoteFeatureFlags: true,
    disableSurveys: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    personProfiles: 'never',
    customAppProperties: {},
    before_send(event) {
      if (!active() || !event) return null;
      const allowed = new Set(['distinct_id', '$session_id', '$lib', '$lib_version', '$geoip_disable', '$process_person_profile']);
      event.properties = Object.fromEntries(Object.entries(event.properties ?? {}).filter(([name]) => allowed.has(name)));
      return event;
    },
  });
  return {
    capture: (event) => { if (active()) client.capture(event); },
    stop: () => { void client.optOut().catch(() => {}); },
  };
};
