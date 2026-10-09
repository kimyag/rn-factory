import { blockedAndroidPermissions, blockedReminderPermissions, easUpdateConfig, isPlaceholder, neutrals, sentryPlugin, telemetryPrivacyManifest, validateSettings, type AppSettings, type CustomFont } from '@factory/core';
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
  const routerConfig: NonNullable<ExpoConfig['plugins']> = settings.modules.ai
    ? [['expo-router', isPlaceholder(settings.ai.serverUrl) ? {} : { origin: settings.ai.serverUrl }]]
    : ['expo-router'];

  return {
    ...config,
    name: settings.name,
    slug: settings.slug,
    scheme: settings.slug,
    icon: settings.branding.assets.icon,
    web: {
      ...config.web,
      favicon: settings.branding.assets.icon,
      output: settings.modules.ai ? 'server' : 'static',
    },
    ios: {
      ...config.ios,
      bundleIdentifier: settings.bundleIds.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: settings.usesNonExemptEncryption,
      },
      privacyManifests: {
        ...config.ios?.privacyManifests,
        ...telemetryPrivacyManifest(settings),
      },
    },
    android: {
      ...config.android,
      package: settings.bundleIds.android,
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        ...blockedAndroidPermissions(settings),
        ...blockedReminderPermissions(settings),
      ],
      adaptiveIcon: {
        backgroundColor: settings.branding.assets.androidAdaptiveIcon.background,
        backgroundImage: settings.branding.assets.androidAdaptiveIcon.backgroundImage,
        foregroundImage: settings.branding.assets.androidAdaptiveIcon.foreground,
        monochromeImage: settings.branding.assets.androidAdaptiveIcon.monochrome,
      },
    },
    plugins: [
      ...(config.plugins ?? []).filter((plugin) => plugin !== 'expo-splash-screen' && plugin !== 'expo-router'),
      ...routerConfig,
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
      ...sentryPlugin(settings),
      ...(settings.modules.reminders ? ['expo-notifications'] : []),
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
