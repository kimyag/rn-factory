import type { AppSettings } from '@factory/core';

const settings: AppSettings = {
  name: 'Switch Companion',
  slug: 'switch-companion',
  bundleIds: {
    ios: 'com.kimyag.switchcompanion',
    android: 'com.kimyag.switchcompanion',
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
        backgroundImage: './assets/images/android-icon-background.png',
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
    title: {
      family: 'Newsreader28pt-Medium',
      file: './assets/fonts/Newsreader28pt-Medium.ttf',
      weight: 500,
    },
    mono: {
      family: 'IBMPlexMono-Regular',
      file: './assets/fonts/IBMPlexMono-Regular.ttf',
      weight: 400,
    },
  },
  privacyUrl: 'https://example.com/PRIVACY_URL_PLACEHOLDER',
  contactEmail: 'contact-placeholder@example.com',
  modules: {
    payments: false,
    crashReports: true,
    analytics: true,
    ai: true,
    reminders: false,
  },
  ai: {
    serverUrl: 'AI_EAS_HOSTING_URL_PLACEHOLDER',
    openModelBaseUrl: 'https://openrouter.ai/api/v1',
    openModel: 'openai/gpt-oss-20b:free',
  },
  // The Test Store key works in development builds only. The store keys are
  // placeholders until #14, #15, and #16.
  payments: {
    revenueCatIosApiKey: 'REVENUECAT_IOS_API_KEY_PLACEHOLDER',
    revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
    revenueCatTestStoreApiKey: 'REVENUECAT_TEST_STORE_API_KEY_PLACEHOLDER',
  },
  telemetry: {
    sentryOrganization: 'SENTRY_ORGANIZATION_PLACEHOLDER',
    sentryProject: 'SENTRY_PROJECT_PLACEHOLDER',
    sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
    posthogApiKey: 'POSTHOG_API_KEY_PLACEHOLDER',
    posthogHost: 'POSTHOG_HOST_PLACEHOLDER',
  },
  eas: {
    owner: 'EAS_OWNER_PLACEHOLDER',
    projectId: 'EAS_PROJECT_ID_PLACEHOLDER',
  },
  stores: {
    // Placeholders until #14 (Apple developer account).
    apple: {
      teamId: 'APPLE_TEAM_ID_PLACEHOLDER',
      ascAppId: 'ASC_APP_ID_PLACEHOLDER',
    },
    // The key file is not in git; it comes with #15 (Google Play account).
    google: {
      serviceAccountKeyPath: './secrets/google-play-service-account.json',
    },
  },
};

export default settings;
