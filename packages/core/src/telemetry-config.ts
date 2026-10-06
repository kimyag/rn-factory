import { isPlaceholder, type AppSettings } from './settings.ts';

export function sentryPlugin(settings: AppSettings): [] | [[string, { organization: string; project: string }]] {
  const { sentryDsn, sentryOrganization, sentryProject } = settings.telemetry;
  if (!settings.modules.crashReports || [sentryDsn, sentryOrganization, sentryProject].some(isPlaceholder)) return [];
  return [['@sentry/react-native/expo', { organization: sentryOrganization, project: sentryProject }]];
}

export function telemetryPrivacyManifest(settings: AppSettings) {
  const types: { NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean;
    NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] }[] = [];
  if (settings.modules.crashReports) {
    for (const type of ['CrashData', 'OtherDiagnosticData']) types.push({
      NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
      NSPrivacyCollectedDataTypeLinked: false,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    });
  }
  if (settings.modules.analytics) {
    for (const type of ['DeviceID', 'ProductInteraction']) types.push({
      NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
    });
  }
  return {
    NSPrivacyTracking: false,
    NSPrivacyTrackingDomains: [],
    NSPrivacyCollectedDataTypes: types,
    NSPrivacyAccessedAPITypes: [
      { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
      { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
      { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
    ],
  };
}
