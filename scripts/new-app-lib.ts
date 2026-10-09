// Pure parts of `pnpm new-app`: build and check the new app's settings, copy what an app owns
// from apps/template-app, and write the files. No installs or commands run here.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isPlaceholder, validateSettings, type AppSettings, type FontRole } from '../packages/core/src/index.ts';

export const bundledFonts = {
  newsreader: { family: 'Newsreader28pt-Medium', file: 'Newsreader28pt-Medium.ttf', weight: 500, license: 'Newsreader-OFL.txt' },
  'ibm-plex-mono': { family: 'IBMPlexMono-Regular', file: 'IBMPlexMono-Regular.ttf', weight: 400, license: 'IBMPlexMono-OFL.txt' },
} as const;

export type BundledFont = keyof typeof bundledFonts;

export type FontChoice =
  | { kind: 'bundled'; key: BundledFont }
  | { kind: 'system' }
  | { kind: 'file'; path: string; family: string; weight: number };

export type NewAppValues = {
  name: string;
  slug: string;
  iosBundleId: string;
  androidBundleId: string;
  colorLight: string;
  colorDark: string;
  titleFont: FontChoice;
};

// What an app owns. Everything else in the template (eas.json, icons, LICENSE, .vscode) is
// generated or not copied; src/fonts.ts and app.settings.ts are written, not copied.
export const copiedFiles = ['.gitignore', 'app.config.ts', 'app.json', 'metro.config.js', 'package.json', 'tsconfig.json', 'src/expo-types.d.ts'];
export const copiedFolders = ['src/app', 'src/feature', 'src/text', 'assets/onboarding', 'modules'];

const fontsFolder = 'assets/fonts';
const placeholderValues = { owner: 'EAS_OWNER_PLACEHOLDER', projectId: 'EAS_PROJECT_ID_PLACEHOLDER' };
// Each app has its own RevenueCat project, so it never inherits the template's keys.
const paymentPlaceholders: AppSettings['payments'] = {
  revenueCatIosApiKey: 'REVENUECAT_IOS_API_KEY_PLACEHOLDER',
  revenueCatAndroidApiKey: 'REVENUECAT_ANDROID_API_KEY_PLACEHOLDER',
  revenueCatTestStoreApiKey: 'REVENUECAT_TEST_STORE_API_KEY_PLACEHOLDER',
};

export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function loadSettings(file: string): Promise<AppSettings> {
  const { default: settings } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return settings;
}

export function resolveTitleFont(templateDir: string, choice: FontChoice): { role: FontRole; copies: { from: string; to: string }[] } {
  if (choice.kind === 'system') {
    return { role: 'system', copies: [] };
  }
  if (choice.kind === 'bundled') {
    const font = bundledFonts[choice.key];
    return {
      role: { family: font.family, file: `./${fontsFolder}/${font.file}`, weight: font.weight },
      copies: [font.file, font.license].map((name) => ({ from: join(templateDir, fontsFolder, name), to: `${fontsFolder}/${name}` })),
    };
  }
  if (!/\.(ttf|otf)$/.test(choice.path)) {
    throw new Error('The title font file must be a .ttf or .otf file.');
  }
  const file = basename(choice.path);
  if (file === bundledFonts['ibm-plex-mono'].file) {
    throw new Error(`Rename the title font file: ${file} is the mono font of every app.`);
  }
  return {
    role: { family: choice.family, file: `./${fontsFolder}/${file}`, weight: choice.weight },
    copies: [{ from: choice.path, to: `${fontsFolder}/${file}` }],
  };
}

function monoCopies(templateDir: string): { from: string; to: string }[] {
  const font = bundledFonts['ibm-plex-mono'];
  return [font.file, font.license].map((name) => ({ from: join(templateDir, fontsFolder, name), to: `${fontsFolder}/${name}` }));
}

export function buildSettings(template: AppSettings, values: NewAppValues, title: FontRole): AppSettings {
  if (/[\u0000-\u001f]/.test(values.name)) {
    throw new Error('The app name must not contain control characters.');
  }
  if (!/^[a-z]/.test(values.slug)) {
    throw new Error('The slug must start with a letter (it is also the URL scheme).');
  }
  const settings: AppSettings = structuredClone(template);
  settings.name = values.name.trim();
  settings.slug = values.slug;
  settings.bundleIds = { ios: values.iosBundleId, android: values.androidBundleId };
  settings.appColor = { light: values.colorLight.toUpperCase(), dark: values.colorDark.toUpperCase() };
  settings.fonts = { ...settings.fonts, title };
  settings.modules = { ...settings.modules, payments: false, ai: false };
  settings.eas = { ...placeholderValues };
  settings.payments = { ...paymentPlaceholders };
  const validated = validateSettings(settings);
  const leaked = [
    ...Object.values(validated.telemetry),
    ...Object.values(validated.stores.apple),
  ].filter((value) => !isPlaceholder(value));
  if (leaked.length > 0) {
    throw new Error('The template settings hold real store or telemetry values; a new app must start with placeholders.');
  }
  return validated;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function replaceOnce(source: string, pattern: RegExp, replacement: string, label: string): string {
  const matches = source.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`The template changed: expected exactly one ${label} to patch, found ${matches.length}. Update scripts/new-app-lib.ts.`);
  }
  return source.replace(pattern, () => replacement);
}

export function patchSettingsSource(source: string, settings: AppSettings): string {
  const title = settings.fonts.title;
  const titleBlock =
    title === 'system'
      ? "    title: 'system',"
      : `    title: {\n      family: ${quote(title.family)},\n      file: ${quote(title.file)},\n      weight: ${title.weight},\n    },`;
  let result = source;
  result = replaceOnce(result, /^ {2}name: '.*',$/m, `  name: ${quote(settings.name)},`, 'name');
  result = replaceOnce(result, /^ {2}slug: '.*',$/m, `  slug: ${quote(settings.slug)},`, 'slug');
  result = replaceOnce(result, /^ {4}ios: '.*',$/m, `    ios: ${quote(settings.bundleIds.ios)},`, 'iOS bundle ID');
  result = replaceOnce(result, /^ {4}android: '.*',$/m, `    android: ${quote(settings.bundleIds.android)},`, 'Android package');
  result = replaceOnce(result, /^ {4}light: '.*',$/m, `    light: ${quote(settings.appColor.light)},`, 'light app color');
  result = replaceOnce(result, /^ {4}dark: '.*',$/m, `    dark: ${quote(settings.appColor.dark)},`, 'dark app color');
  result = replaceOnce(result, /^ {4}title: (?:'system'|\{\n(?: {6}.*\n)+? {4}\}),$/m, titleBlock, 'title font');
  result = replaceOnce(result, /^ {4}payments: (?:true|false),$/m, '    payments: false,', 'payments module switch');
  result = replaceOnce(result, /^ {4}ai: (?:true|false),$/m, '    ai: false,', 'AI module switch');
  for (const [key, value] of Object.entries(settings.payments)) {
    result = replaceOnce(result, new RegExp(`^ {4}${key}: '.*',$`, 'm'), `    ${key}: ${quote(value)},`, key);
  }
  result = replaceOnce(result, /^ {4}owner: '.*',$/m, `    owner: ${quote(settings.eas.owner)},`, 'EAS owner');
  result = replaceOnce(result, /^ {4}projectId: '.*',$/m, `    projectId: ${quote(settings.eas.projectId)},`, 'EAS project ID');
  return result;
}

export function renderFonts(fonts: AppSettings['fonts']): string {
  const lines = (['title', 'mono'] as const).flatMap((role) => {
    const font = fonts[role];
    return font === 'system' ? [] : [`  ${role}: require('../${font.file.slice(2)}'),`];
  });
  const body = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
  return `import type { FontFiles } from '@factory/app';\n\nexport const fontFiles: FontFiles = {${body}};\n`;
}

function writeText(file: string, contents: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function patchFile(file: string, pattern: RegExp, replacement: string, label: string) {
  writeFileSync(file, replaceOnce(readFileSync(file, 'utf8'), pattern, replacement, label));
}

// Validates first and writes nothing if anything is wrong; refuses an existing folder.
export async function scaffold(options: { appsRoot: string; templateDir: string; values: NewAppValues }): Promise<string> {
  const { appsRoot, templateDir, values } = options;
  const target = join(appsRoot, values.slug);
  const template = await loadSettings(join(templateDir, 'app.settings.ts'));
  const title = resolveTitleFont(templateDir, values.titleFont);
  const settings = buildSettings(template, values, title.role);
  const settingsSource = patchSettingsSource(readFileSync(join(templateDir, 'app.settings.ts'), 'utf8'), settings);
  if (existsSync(target)) {
    throw new Error(`apps/${values.slug} already exists; new-app never overwrites an app.`);
  }

  for (const file of copiedFiles) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    copyFileSync(join(templateDir, file), join(target, file));
  }
  for (const folder of copiedFolders) {
    if (existsSync(join(templateDir, folder))) {
      cpSync(join(templateDir, folder), join(target, folder), { recursive: true });
    }
  }
  for (const { from, to } of [...title.copies, ...monoCopies(templateDir)]) {
    mkdirSync(dirname(join(target, to)), { recursive: true });
    copyFileSync(from, join(target, to));
  }

  const packageFile = join(target, 'package.json');
  const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
  const scripts = Object.fromEntries(
    Object.entries<string>(manifest.scripts).map(([key, command]) => [key, command.replace(/(brand-assets\.mjs) template-app$/, `$1 ${values.slug}`)]),
  );
  writeText(packageFile, `${JSON.stringify({ ...manifest, name: values.slug, scripts }, null, 2)}\n`);
  patchFile(join(target, 'app.json'), /"scheme": "[^"]*"/, `"scheme": "${values.slug}"`, 'URL scheme');
  for (const language of ['en', 'tr']) {
    patchFile(join(target, 'src/text', `${language}.ts`), /^ {2}'feature\.title': '.*',$/m, `  'feature.title': ${quote(settings.name)},`, `${language} feature title`);
  }
  writeText(join(target, 'src/fonts.ts'), renderFonts(settings.fonts));
  writeText(join(target, 'app.settings.ts'), settingsSource);

  const written = await loadSettings(join(target, 'app.settings.ts'));
  if (JSON.stringify(validateSettings(written)) !== JSON.stringify(settings)) {
    throw new Error(`apps/${values.slug}/app.settings.ts does not match the validated settings; please report this.`);
  }
  return target;
}
