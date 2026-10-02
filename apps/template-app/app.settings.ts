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
  modules: {
    payments: false,
    analytics: false,
  },
};

export default settings;
