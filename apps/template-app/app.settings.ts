import type { AppSettings } from '@factory/core';

const settings: AppSettings = {
  name: 'Template App',
  slug: 'template-app',
  bundleIds: {
    ios: 'com.example.templateapp',
    android: 'com.example.templateapp',
  },
  colors: {
    primary: '#208AEF',
    background: '#FFFFFF',
  },
  privacyUrl: 'https://example.com/PRIVACY_URL_PLACEHOLDER',
  modules: {
    payments: false,
    analytics: false,
  },
};

export default settings;
