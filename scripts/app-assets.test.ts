import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { neutrals } from '../packages/core/src/color.ts';
import { assetSize, firstLetter, generateAppAssets } from './app-assets.ts';
import { loadSettings, scaffold, type NewAppValues } from './new-app-lib.ts';

const templateDir = fileURLToPath(new URL('../apps/template-app/', import.meta.url));
const values: NewAppValues = {
  name: 'Switch Companion', slug: 'switch-companion',
  iosBundleId: 'com.example.switchcompanion', androidBundleId: 'com.example.switchcompanion',
  colorLight: '#C8372D', colorDark: '#F0644E', titleFont: { kind: 'bundled', key: 'newsreader' },
};

async function fixture(run: (root: string, settings: Awaited<ReturnType<typeof loadSettings>>) => Promise<void>) {
  const folder = await mkdtemp(join(tmpdir(), 'app-assets-test-'));
  try {
    const root = await scaffold({ appsRoot: folder, templateDir, values });
    await run(root, await loadSettings(join(root, 'app.settings.ts')));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

function pixels(png: Buffer): Buffer {
  return new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${assetSize}" height="${assetSize}"><image width="${assetSize}" height="${assetSize}" href="data:image/png;base64,${png.toString('base64')}" /></svg>`).render().pixels;
}
function rgb(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function pixel(image: Buffer, x: number, y: number): number[] {
  return Array.from(image.subarray((y * assetSize + x) * 4, (y * assetSize + x) * 4 + 4));
}

test('scaffold assets include every required PNG, dimensions, colors and alpha layers', async () => {
  await fixture(async (root, settings) => {
    const files = await generateAppAssets(root, settings);
    assert.deepEqual(files.map((file) => file.split('/').at(-1)).sort(), [
      'icon.png', 'android-icon-foreground.png', 'android-icon-background.png',
      'android-icon-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png',
    ].sort());
    for (const file of files) {
      const png = await readFile(file);
      assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(png.readUInt32BE(16), 1024, file);
      assert.equal(png.readUInt32BE(20), 1024, file);
      const image = pixels(png);
      const transparent = /foreground|monochrome/.test(file);
      const paper = file.endsWith('splash-icon-dark.png') ? neutrals.dark.paper : neutrals.light.paper;
      assert.deepEqual(pixel(image, 0, 0), transparent ? [0, 0, 0, 0] : [...rgb(paper), 255]);
      if (!file.endsWith('android-icon-background.png')) {
        const color = file.endsWith('splash-icon-dark.png') ? settings.appColor.dark
          : file.endsWith('android-icon-monochrome.png') ? neutrals.light.ink : settings.appColor.light;
        assert.deepEqual(pixel(image, Math.round(assetSize * 0.36), assetSize / 2), [...rgb(color), 255]);
      }
    }
  });
});

test('foreground and monochrome artwork fit Android safe circle, with matching silhouettes', async () => {
  await fixture(async (root, settings) => {
    await generateAppAssets(root, settings);
    const foreground = pixels(await readFile(join(root, settings.branding.assets.androidAdaptiveIcon.foreground)));
    const monochrome = pixels(await readFile(join(root, settings.branding.assets.androidAdaptiveIcon.monochrome)));
    let letterPixels = 0;
    for (let y = 0; y < assetSize; y += 1) {
      for (let x = 0; x < assetSize; x += 1) {
        const offset = (y * assetSize + x) * 4;
        assert.equal(foreground[offset + 3], monochrome[offset + 3]);
        if (foreground[offset + 3]) {
          assert.ok(Math.hypot(x + 0.5 - assetSize / 2, y + 0.5 - assetSize / 2) <= assetSize * 33 / 108);
          if (x > assetSize * 0.5) letterPixels += 1;
        }
      }
    }
    assert.ok(letterPixels > 1000, 'the Newsreader letter must actually render');
  });
});

test('regenerating changes the initial and color, with deterministic output', async () => {
  await fixture(async (root, settings) => {
    await generateAppAssets(root, settings);
    const icon = join(root, settings.branding.assets.icon);
    const original = await readFile(icon);
    await generateAppAssets(root, settings);
    assert.deepEqual(await readFile(icon), original);
    const renamed = { ...settings, name: 'Çiçek' };
    await generateAppAssets(root, renamed);
    const differentLetter = await readFile(icon);
    assert.notDeepEqual(differentLetter, original);
    await generateAppAssets(root, { ...renamed, appColor: { light: '#2F6B3A', dark: '#7FD08A' } });
    assert.notDeepEqual(await readFile(icon), differentLetter);
  });
});

test('contrast, escaped paths and duplicate paths are rejected before existing images change', async () => {
  await fixture(async (root, settings) => {
    await generateAppAssets(root, settings);
    const icon = join(root, settings.branding.assets.icon);
    const original = await readFile(icon);
    await assert.rejects(generateAppAssets(root, { ...settings, appColor: { light: '#FFFFFF', dark: '#000000' } }), /contrast/);
    const escaped = structuredClone(settings);
    escaped.branding.assets.icon = './assets/../../outside.png';
    await assert.rejects(generateAppAssets(root, escaped), /escapes/);
    const duplicated = structuredClone(settings);
    duplicated.branding.assets.splash.image = duplicated.branding.assets.icon;
    await assert.rejects(generateAppAssets(root, duplicated), /distinct/);
    assert.deepEqual(await readFile(icon), original);
  });
});

test('settings may place images directly in the assets folder', async () => {
  await fixture(async (root, settings) => {
    const direct = structuredClone(settings);
    direct.branding.assets.icon = './assets/icon.png';
    const files = await generateAppAssets(root, direct);
    assert.ok(files.includes(join(root, 'assets/icon.png')));
    assert.equal((await readFile(join(root, 'assets/icon.png'))).readUInt32BE(16), assetSize);
  });
});

test('the template app keeps every existing asset unchanged', async () => {
  const settings = await loadSettings(join(templateDir, 'app.settings.ts'));
  const { assets } = settings.branding;
  const files = [assets.icon, assets.androidAdaptiveIcon.foreground, assets.androidAdaptiveIcon.monochrome, assets.splash.image, assets.splash.darkImage];
  const before = await Promise.all(files.map((file) => readFile(join(templateDir, file))));
  await assert.rejects(generateAppAssets(templateDir, settings), /template app keeps/);
  assert.deepEqual(await Promise.all(files.map((file) => readFile(join(templateDir, file)))), before);
});

test('initials preserve Turkish accents, normalize combining accents and skip leading symbols', () => {
  assert.equal(firstLetter(' Çiçek'), 'Ç');
  assert.equal(firstLetter('İş'), 'İ');
  assert.equal(firstLetter('E\u0301tude'), 'É');
  assert.equal(firstLetter('★ Switch Companion'), 'S');
});
