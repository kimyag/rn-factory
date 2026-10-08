import { z } from 'zod';

import { contrastRatio, neutrals, type ColorScheme } from './color.ts';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a hex color like #1A2B3C');

export function appColorProblems(scheme: ColorScheme, color: string): string[] {
  const { paper } = neutrals[scheme];
  const problems: string[] = [];
  const onPaper = contrastRatio(color, paper);
  if (onPaper < 3) {
    problems.push(`needs at least 3:1 contrast on the ${scheme} background ${paper} (now ${onPaper.toFixed(2)}:1)`);
  }
  const dot = contrastRatio(paper, color);
  if (dot < 4.5) {
    problems.push(`the ${paper} dot on it needs at least 4.5:1 contrast (now ${dot.toFixed(2)}:1)`);
  }
  return problems;
}

const appColor = z
  .strictObject({ light: hexColor, dark: hexColor })
  .superRefine((color, ctx) => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const message of appColorProblems(scheme, color[scheme])) {
        ctx.addIssue({ code: 'custom', path: [scheme], message });
      }
    }
  });

const customFont = z.strictObject({
  family: z.string().trim().min(1, 'must be the PostScript name inside the font file'),
  file: z
    .string()
    .regex(/^\.\/.+\.(ttf|otf)$/, 'must be a ./path to a .ttf or .otf file in the app folder'),
  weight: z
    .number()
    .min(100, 'must be 100, 200, … or 900')
    .max(900, 'must be 100, 200, … or 900')
    .multipleOf(100, 'must be 100, 200, … or 900'),
});

const fontRole = z.union([z.literal('system'), customFont]);

export const reminderSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  time: z.string(),
  id: z.string().nullable(),
});

const branding = z.strictObject({
  assets: z.strictObject({
    icon: z.string().regex(/^\.\/assets\/.+\.png$/, 'must be a PNG path inside the app assets folder'),
    androidAdaptiveIcon: z.strictObject({
      foreground: z.string().regex(/^\.\/assets\/.+\.png$/, 'must be a PNG path inside the app assets folder'),
      monochrome: z.string().regex(/^\.\/assets\/.+\.png$/, 'must be a PNG path inside the app assets folder'),
      background: hexColor,
    }),
    splash: z.strictObject({
      image: z.string().regex(/^\.\/assets\/.+\.png$/, 'must be a PNG path inside the app assets folder'),
      darkImage: z.string().regex(/^\.\/assets\/.+\.png$/, 'must be a PNG path inside the app assets folder'),
      imageWidth: z.number().int().min(1).max(1024),
    }),
  }),
});

export function isPlaceholder(value: string): boolean {
  return /^[A-Z0-9_]+_PLACEHOLDER$/.test(value);
}

function realOrPlaceholder(pattern: RegExp, message: string) {
  return z
    .string()
    .refine((value) => isPlaceholder(value) || pattern.test(value), `${message} or a NAME_PLACEHOLDER`);
}

export const appSettingsSchema = z.strictObject({
  name: z.string().trim().min(1, 'must not be empty'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must use lowercase letters, digits, and hyphens'),
  bundleIds: z.strictObject({
    ios: z
      .string()
      .regex(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/, 'must be reverse-DNS like com.example.app'),
    android: z
      .string()
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/,
        'must be a package name like com.example.app',
      ),
  }),
  appColor,
  branding,
  fonts: z.strictObject({ title: fontRole, mono: fontRole }),
  privacyUrl: z.url({ protocol: /^https$/, error: 'must be an https URL' }),
  contactEmail: z.email('must be an email address'),
  modules: z.strictObject({
    payments: z.boolean(),
    crashReports: z.boolean(),
    analytics: z.boolean(),
    ai: z.boolean(),
    reminders: z.boolean(),
  }),
  telemetry: z.strictObject({
    sentryOrganization: z.string().trim().min(1),
    sentryProject: z.string().trim().min(1),
    sentryDsn: z.string().refine(
      (value) => isPlaceholder(value) || z.url({ protocol: /^https$/ }).safeParse(value).success,
      'must be an HTTPS Sentry DSN or a NAME_PLACEHOLDER',
    ),
    posthogApiKey: z.string().trim().min(1),
    posthogHost: z.string().refine(
      (value) => isPlaceholder(value) || z.url({ protocol: /^https$/ }).safeParse(value).success,
      'must be an HTTPS PostHog host or a NAME_PLACEHOLDER',
    ),
  }),
  payments: z.strictObject({
    revenueCatIosApiKey: realOrPlaceholder(/^appl_\w+$/, 'must be the RevenueCat iOS API key (appl_…)'),
    revenueCatAndroidApiKey: realOrPlaceholder(/^goog_\w+$/, 'must be the RevenueCat Android API key (goog_…)'),
    revenueCatTestStoreApiKey: realOrPlaceholder(/^test_\w+$/, 'must be the RevenueCat Test Store API key (test_…)'),
  }),
  ai: z.strictObject({
    serverUrl: z.string().refine(
      (value) => isPlaceholder(value) || z.url({ protocol: /^https$/ }).safeParse(value).success,
      'must be an HTTPS EAS Hosting URL or a NAME_PLACEHOLDER',
    ),
  }),
  eas: z.strictObject({
    owner: realOrPlaceholder(/^[a-z0-9][a-z0-9_-]*$/, 'must be your Expo username or organization'),
    projectId: realOrPlaceholder(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      'must be the EAS project ID (a UUID)',
    ),
  }),
  stores: z.strictObject({
    apple: z.strictObject({
      teamId: realOrPlaceholder(/^[A-Z0-9]{10}$/, 'must be the 10-character Apple Team ID'),
      ascAppId: realOrPlaceholder(/^\d+$/, 'must be the numeric App Store Connect app ID'),
    }),
    google: z.strictObject({
      serviceAccountKeyPath: z
        .string()
        .regex(/^\.\/.+\.json$/, 'must be a ./path to the Google service account JSON key'),
    }),
  }),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type FontRole = z.infer<typeof fontRole>;
export type CustomFont = z.infer<typeof customFont>;

function describe(issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'invalid_union') {
    const branches = issue.errors.filter((branch) => branch.some((inner) => inner.path.length > 0));
    if (branches.length > 0) {
      return branches.flat().map((inner) => describe({ ...inner, path: [...issue.path, ...inner.path] })).flat();
    }
    return [`  - ${issue.path.join('.')}: must be 'system' or { family, file, weight }`];
  }
  return [`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`];
}

export function validateSettings(input: unknown): AppSettings {
  const result = appSettingsSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.flatMap(describe);
  throw new Error(`Invalid app settings (app.settings.ts):\n${problems.join('\n')}`);
}
