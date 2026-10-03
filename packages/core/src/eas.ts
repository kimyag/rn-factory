import { isPlaceholder, type AppSettings } from './settings.ts';

export const easNodeVersion = '22.23.3';

// EAS rejects placeholder IDs, so eas.json leaves a value out until it is real.
function real(value: string): string | undefined {
  return isPlaceholder(value) ? undefined : value;
}

export function easConfig(settings: AppSettings, pnpmVersion: string) {
  const { apple, google } = settings.stores;

  return {
    cli: { version: '>= 24.9.0', appVersionSource: 'remote' },
    build: {
      base: { node: easNodeVersion, pnpm: pnpmVersion },
      development: {
        extends: 'base',
        developmentClient: true,
        distribution: 'internal',
        ios: { simulator: true },
      },
      preview: {
        extends: 'base',
        distribution: 'internal',
        android: { buildType: 'apk' },
      },
      production: {
        extends: 'base',
        autoIncrement: true,
      },
    },
    submit: {
      production: {
        ios: {
          appleTeamId: real(apple.teamId),
          ascAppId: real(apple.ascAppId),
        },
        android: {
          serviceAccountKeyPath: google.serviceAccountKeyPath,
          track: 'internal',
        },
      },
    },
  };
}
