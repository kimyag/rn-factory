import { validateSettings } from '@factory/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';

import appSettings from './app.settings.ts';

export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = validateSettings(appSettings);

  return {
    ...config,
    name: settings.name,
    slug: settings.slug,
    ios: { ...config.ios, bundleIdentifier: settings.bundleIds.ios },
    android: { ...config.android, package: settings.bundleIds.android },
  };
};
