import { validateSettings, type AppSettings, type CustomFont } from '@factory/core';
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
    plugins: [...(config.plugins ?? []), ...fontPlugin(settings.fonts)],
  };
};

function fontPlugin(fonts: AppSettings['fonts']): NonNullable<ExpoConfig['plugins']> {
  const custom = Object.values(fonts).filter((font): font is CustomFont => font !== 'system');
  if (custom.length === 0) {
    return [];
  }
  return [
    [
      'expo-font',
      {
        ios: { fonts: custom.map((font) => font.file) },
        android: {
          fonts: custom.map((font) => ({
            fontFamily: font.family,
            fontDefinitions: [{ path: font.file, weight: font.weight }],
          })),
        },
      },
    ],
  ];
}
