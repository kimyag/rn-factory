import { Resvg } from '@resvg/resvg-js';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { neutrals } from '../packages/core/src/color.ts';
import { validateSettings } from '../packages/core/src/settings.ts';
import { mark } from '../packages/ui/src/tokens.ts';

export const assetSize = 1024;
const newsreader = fileURLToPath(new URL('../apps/template-app/assets/fonts/Newsreader28pt-Medium.ttf', import.meta.url));
const fontOptions = { fontFiles: [newsreader], loadSystemFonts: false, defaultFontFamily: 'Newsreader' };

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

export function firstLetter(name: string): string {
  const segments = new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(name.trim().normalize('NFC'));
  const letter = Array.from(segments).find(({ segment }) => /[\p{L}\p{N}]/u.test(segment))?.segment;
  if (!letter) throw new Error('Placeholder assets need an app name containing a letter or number.');
  return Array.from(letter.toUpperCase())[0];
}

function svg(contents: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${assetSize}" height="${assetSize}" viewBox="0 0 ${assetSize} ${assetSize}">${contents}</svg>`;
}

function render(contents: string): Buffer {
  return new Resvg(svg(contents), { font: fontOptions }).render().asPng();
}

function artwork(letter: string, color: string, ink: string): string {
  const diameter = assetSize * 0.28;
  const stroke = diameter * mark.ring / mark.size;
  const dot = diameter * mark.dot / mark.size / 2;
  const ringX = assetSize * 0.36;
  const centerY = assetSize / 2;
  // Measure the actual bundled glyph, including accents, before fitting it beside the Mark.
  const glyph = `<text font-family="Newsreader" font-weight="500" font-size="${assetSize}" fill="${ink}">${escapeXml(letter)}</text>`;
  const bounds = new Resvg(svg(glyph), { font: fontOptions }).getBBox();
  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    throw new Error(`The bundled Newsreader font cannot render the app initial: ${letter}`);
  }
  const scale = Math.min(assetSize * 0.24 / bounds.width, diameter / bounds.height);
  const letterX = assetSize * 0.65;
  const translateX = letterX - (bounds.x + bounds.width / 2) * scale;
  const translateY = centerY - (bounds.y + bounds.height / 2) * scale;
  return `<circle cx="${ringX}" cy="${centerY}" r="${(diameter - stroke) / 2}" fill="none" stroke="${color}" stroke-width="${stroke}" />
    <circle cx="${ringX}" cy="${centerY}" r="${dot}" fill="${color}" />
    <g transform="translate(${translateX} ${translateY}) scale(${scale})">${glyph}</g>`;
}

function backdrop(color: string): string {
  return `<rect width="${assetSize}" height="${assetSize}" fill="${color}" />`;
}

export async function generateAppAssets(appRoot: string, input: unknown): Promise<string[]> {
  if (resolve(appRoot).split(sep).at(-1) === 'template-app') {
    throw new Error('The template app keeps its current artwork; app:assets does not overwrite it.');
  }
  const settings = validateSettings(input);
  const { assets } = settings.branding;
  const background = assets.androidAdaptiveIcon.backgroundImage;
  if (!background) throw new Error('Set branding.assets.androidAdaptiveIcon.backgroundImage before generating placeholder assets.');
  const light = artwork(firstLetter(settings.name), settings.appColor.light, neutrals.light.ink);
  const dark = artwork(firstLetter(settings.name), settings.appColor.dark, neutrals.dark.ink);
  const monochrome = artwork(firstLetter(settings.name), neutrals.light.ink, neutrals.light.ink);
  const outputs = [
    [assets.icon, render(backdrop(neutrals.light.paper) + light)],
    [assets.androidAdaptiveIcon.foreground, render(light)],
    [background, render(backdrop(neutrals.light.paper))],
    [assets.androidAdaptiveIcon.monochrome, render(monochrome)],
    [assets.splash.image, render(backdrop(neutrals.light.paper) + light)],
    [assets.splash.darkImage, render(backdrop(neutrals.dark.paper) + dark)],
  ] as const;
  const assetsRoot = resolve(appRoot, 'assets');
  const paths = outputs.map(([relativePath]) => resolve(appRoot, relativePath));
  if (paths.some((path) => !path.startsWith(`${assetsRoot}${sep}`))) {
    throw new Error('Generated image path escapes app assets.');
  }
  if (new Set(paths).size !== paths.length) throw new Error('Brand asset paths must be distinct.');
  // Validate parent directories before writing, including symlinks inside assets.
  const realAppRoot = await realpath(appRoot);
  for (const path of paths) {
    await mkdir(dirname(path), { recursive: true });
    const parent = await realpath(dirname(path));
    const realAssetsRoot = resolve(realAppRoot, 'assets');
    if (parent !== realAssetsRoot && !parent.startsWith(`${realAssetsRoot}${sep}`)) {
      throw new Error('Generated image directory escapes app assets.');
    }
  }
  for (const path of paths) {
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (existing?.isSymbolicLink()) throw new Error('Generated image files cannot be symlinks.');
  }
  for (const [index, [, contents]] of outputs.entries()) await writeFile(paths[index], contents);
  return paths;
}

async function main() {
  const app = process.argv[2];
  if (process.argv.length !== 3 || !app || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) {
    throw new Error('Usage: pnpm app:assets <app-folder-name>');
  }
  const appRoot = fileURLToPath(new URL(`../apps/${app}/`, import.meta.url));
  const { default: input } = await import(pathToFileURL(resolve(appRoot, 'app.settings.ts')).href);
  await generateAppAssets(appRoot, input);
  process.stdout.write(`Generated placeholder icons and splash for ${app}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
