import type { AppSettings } from './settings.ts';

// Test-only settings for @factory/core, so shared code does not depend on an app.
export const testSettings: AppSettings = {
  name: 'Fixture App',
  slug: 'fixture-app',
  bundleIds: {
    ios: 'com.example.fixtureapp',
    android: 'com.example.fixtureapp',
  },
  appColor: {
    light: '#C8372D',
    dark: '#F0644E',
  },
  branding: {
    assets: {
      icon: './assets/images/icon.png',
      androidAdaptiveIcon: {
        foreground: './assets/images/android-icon-foreground.png',
        monochrome: './assets/images/android-icon-monochrome.png',
        background: '#F7F6F2',
      },
      splash: {
        image: './assets/images/splash-icon.png',
        darkImage: './assets/images/splash-icon-dark.png',
        imageWidth: 76,
      },
    },
  },
  fonts: {
    title: 'system',
    mono: 'system',
  },
  privacyUrl: 'https://example.com/PRIVACY_URL_PLACEHOLDER',
  contactEmail: 'contact-placeholder@example.com',
  modules: {
    payments: false,
    ai: false,
    crashReports: true,
    analytics: true,
    reminders: false,
  },
  payments: {
    revenueCatIosApiKey: 'REVENUECAT_IOS_API_KEY_PLACEHOLDER',
    revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
    revenueCatTestStoreApiKey: 'REVENUECAT_TEST_STORE_API_KEY_PLACEHOLDER',
  },
  ai: {
    serverUrl: 'AI_EAS_HOSTING_URL_PLACEHOLDER',
    openModelBaseUrl: 'OPEN_MODEL_BASE_URL_PLACEHOLDER',
    openModel: 'gpt-oss-20b:free',
    dailyLimits: { free: 5, premium: 25 },
  },
  telemetry: {
    sentryOrganization: 'SENTRY_ORGANIZATION_PLACEHOLDER',
    sentryProject: 'SENTRY_PROJECT_PLACEHOLDER',
    sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
    posthogApiKey: 'POSTHOG_API_KEY_PLACEHOLDER',
    posthogHost: 'POSTHOG_HOST_PLACEHOLDER',
  },
  eas: {
    owner: 'fixture-owner',
    projectId: '00000000-0000-4000-8000-000000000000',
  },
  stores: {
    apple: {
      teamId: 'APPLE_TEAM_ID_PLACEHOLDER',
      ascAppId: 'ASC_APP_ID_PLACEHOLDER',
    },
    google: {
      serviceAccountKeyPath: './secrets/google-play-service-account.json',
    },
  },
};
