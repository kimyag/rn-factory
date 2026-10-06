import { easUpdateConfig, isPlaceholder, neutrals, validateSettings, type AppSettings, type CustomFont } from '@factory/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';

import appSettings from './app.settings.ts';

export default (context: ConfigContext): ExpoConfig => {
  // EAS can return Node's CommonJS wrapper for the TypeScript default export.
  const importedSettings: unknown = appSettings;
  const settings = validateSettings(
    typeof importedSettings === 'object' && importedSettings !== null && 'default' in importedSettings
      ? importedSettings.default
      : importedSettings,
  );
  const config = context.config;

  return {
    ...config,
    name: settings.name,
    slug: settings.slug,
    icon: settings.branding.assets.icon,
    web: { ...config.web, favicon: settings.branding.assets.icon },
    ios: { ...config.ios, bundleIdentifier: settings.bundleIds.ios },
    android: {
      ...config.android,
      package: settings.bundleIds.android,
      adaptiveIcon: {
        backgroundColor: settings.branding.assets.androidAdaptiveIcon.background,
        foregroundImage: settings.branding.assets.androidAdaptiveIcon.foreground,
        monochromeImage: settings.branding.assets.androidAdaptiveIcon.monochrome,
      },
    },
    plugins: [
      ...(config.plugins ?? []).filter((plugin) => plugin !== 'expo-splash-screen'),
      [
        'expo-splash-screen',
        {
          backgroundColor: neutrals.light.paper,
          image: settings.branding.assets.splash.image,
          imageWidth: settings.branding.assets.splash.imageWidth,
          dark: {
            backgroundColor: neutrals.dark.paper,
            image: settings.branding.assets.splash.darkImage,
          },
        },
      ],
      ...fontPlugin(settings.fonts),
    ],
    ...easProject(settings.eas, config.extra),
    ...easUpdateConfig(settings.eas),
  };
};

function easProject(eas: AppSettings['eas'], extra: ExpoConfig['extra']): Partial<ExpoConfig> {
  if (isPlaceholder(eas.owner) || isPlaceholder(eas.projectId)) {
    return {};
  }
  return { owner: eas.owner, extra: { ...extra, eas: { projectId: eas.projectId } } };
}

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
