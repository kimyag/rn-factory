// pnpm new-app [name] [--flags]: makes apps/<slug> from apps/template-app and runs the setup steps.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { appSettingsSchema } from '../packages/core/src/index.ts';
import { bundledFonts, scaffold, slugFromName, type BundledFont, type FontChoice, type NewAppValues } from './new-app-lib.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const nodeRun = ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];

const usage = `Usage: pnpm new-app [name] [options]
  --slug <slug>            default: the name in lowercase with hyphens
  --ios <bundle id>        e.g. com.example.myapp
  --android <package>      default: the iOS bundle ID
  --color-light <#RRGGBB>  app color on the light background
  --color-dark <#RRGGBB>   app color on the dark background
  --title-font <font>      ${Object.keys(bundledFonts).join(' | ')} | system | file (default: newsreader)
  --font-file <path>       with --title-font file: a .ttf or .otf file to copy
  --font-family <name>     with --title-font file: the PostScript name inside the file
  --font-weight <100-900>  with --title-font file (default: 400)
  --no-input               never ask; fail when a value is missing
Missing values are asked for when the terminal is interactive.`;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    slug: { type: 'string' },
    ios: { type: 'string' },
    android: { type: 'string' },
    'color-light': { type: 'string' },
    'color-dark': { type: 'string' },
    'title-font': { type: 'string' },
    'font-file': { type: 'string' },
    'font-family': { type: 'string' },
    'font-weight': { type: 'string' },
    'no-input': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (flags.help) {
  process.stdout.write(`${usage}\n`);
  process.exit(0);
}
if (positionals.length > 1) {
  fail(`Expected one app name, got ${positionals.length}. Quote names with spaces.\n${usage}`);
}

const interactive = process.stdin.isTTY === true && !flags['no-input'];
const prompts = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

async function value(given: string | undefined, question: string, check: (input: string) => string | undefined, fallback?: string): Promise<string> {
  let answer = given;
  for (;;) {
    if (answer === undefined) {
      if (!prompts) {
        if (fallback !== undefined) {
          return fallback;
        }
        fail(`Missing value: ${question}\n${usage}`);
      }
      answer = (await prompts.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim() || fallback;
    }
    const problem = answer === undefined ? 'a value is required' : check(answer);
    if (answer !== undefined && problem === undefined) {
      return answer;
    }
    if (given !== undefined || !prompts) {
      fail(`${question}: ${problem}`);
    }
    process.stdout.write(`  ${problem}\n`);
    answer = undefined;
  }
}

function fieldCheck(schema: { safeParse(input: string): { success: boolean; error?: { issues: { message: string }[] } } }) {
  return (input: string) => {
    const result = schema.safeParse(input);
    return result.success ? undefined : result.error?.issues[0]?.message;
  };
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const hex = (input: string) => (/^#[0-9A-Fa-f]{6}$/.test(input) ? undefined : 'must be a hex color like #1A2B3C');

async function fontChoice(): Promise<FontChoice> {
  const choices = [...Object.keys(bundledFonts), 'system', 'file'];
  const key = await value(flags['title-font'], `Title font (${choices.join(', ')})`, (input) => (choices.includes(input) ? undefined : `must be one of ${choices.join(', ')}`), 'newsreader');
  if (key === 'system') {
    return { kind: 'system' };
  }
  if (key !== 'file') {
    return { kind: 'bundled', key: key as BundledFont };
  }
  const path = await value(flags['font-file'], 'Font file (.ttf or .otf)', (input) => (/\.(ttf|otf)$/.test(input) ? undefined : 'must be a .ttf or .otf file'));
  const family = await value(flags['font-family'], 'PostScript name inside the font file', (input) => (input.trim() ? undefined : 'must not be empty'));
  const weight = Number(await value(flags['font-weight'], 'Font weight', (input) => (/^[1-9]00$/.test(input) ? undefined : 'must be 100, 200, … or 900'), '400'));
  return { kind: 'file', path, family, weight };
}

const name = await value(positionals[0], 'App name', (input) => (input.trim() ? undefined : 'must not be empty'));
const slug = await value(flags.slug, 'Slug', fieldCheck(appSettingsSchema.shape.slug), slugFromName(name));
const iosBundleId = await value(flags.ios, 'iOS bundle ID', fieldCheck(appSettingsSchema.shape.bundleIds.shape.ios));
const androidBundleId = await value(flags.android, 'Android package', fieldCheck(appSettingsSchema.shape.bundleIds.shape.android), iosBundleId);
const colorLight = await value(flags['color-light'], 'App color on light (#RRGGBB)', hex);
const colorDark = await value(flags['color-dark'], 'App color on dark (#RRGGBB)', hex);
const titleFont = await fontChoice();
prompts?.close();

const values: NewAppValues = { name, slug, iosBundleId, androidBundleId, colorLight, colorDark, titleFont };

try {
  await scaffold({ appsRoot: `${root}apps`, templateDir: `${root}apps/template-app`, values });
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\nNothing was created.`);
}
process.stdout.write(`Created apps/${slug} with valid settings.\n`);

const steps: [string, string[]][] = [
  ['Link the new app into the workspace', ['pnpm', 'install']],
  ['Generate icons and splash from the settings', ['pnpm', 'assets:brand', slug]],
  ['Write eas.json from the settings', ['pnpm', 'eas:config']],
  ['Typecheck the new app', ['pnpm', '--filter', slug, 'typecheck']],
];
for (const [label, [command, ...args]] of steps) {
  process.stdout.write(`\n> ${label}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`\nStep failed: ${label}. apps/${slug} was kept; fix the problem and run the step again (${[command, ...args].join(' ')}).`);
  }
}

process.stdout.write(`
apps/${slug} is ready. It has no EAS project and no store listing yet. Next, by hand:
  1. Create the EAS project: cd apps/${slug} && npx eas-cli@24.9.0 project:init
     Put the owner and project ID in app.settings.ts (eas), then run pnpm eas:config.
  2. Store IDs: Apple team and App Store Connect app ID (stores.apple, #14); the Google Play
     service account key (stores.google, #15).
  3. Sentry and PostHog values (telemetry), the privacy URL and the contact email.
  4. Payments are off. To turn them on, add the RevenueCat keys and set modules.payments
     (see docs/payments.md).
  5. Replace the placeholder screen (src/feature/home-screen.tsx), the onboarding pages and texts.
  6. Commit the app and pnpm-lock.yaml, then build once: npx eas-cli build --profile development
     and run: pnpm --filter ${slug} start
`);
