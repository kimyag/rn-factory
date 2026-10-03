import type { AppSettings } from '@factory/core';

const settings: AppSettings = {
  name: 'Template App',
  slug: 'template-app',
  bundleIds: {
    ios: 'com.example.templateapp',
    android: 'com.example.templateapp',
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
    analytics: false,
  },
  // Placeholders until #31 (Expo account and EAS project).
  eas: {
    owner: 'EXPO_OWNER_PLACEHOLDER',
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
