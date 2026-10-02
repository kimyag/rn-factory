import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a hex color like #1A2B3C');

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
  colors: z.strictObject({
    primary: hexColor,
    background: hexColor,
  }),
  privacyUrl: z.url({ protocol: /^https$/, error: 'must be an https URL' }),
  modules: z.strictObject({
    payments: z.boolean(),
    analytics: z.boolean(),
  }),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export function validateSettings(input: unknown): AppSettings {
  const result = appSettingsSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(`Invalid app settings (app.settings.ts):\n${problems.join('\n')}`);
}
