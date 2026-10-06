import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { appColorProblems } from '../packages/core/src/index.ts';
import { bundledFonts, copiedFiles, copiedFolders, loadSettings, renderFonts, scaffold, slugFromName, type NewAppValues } from './new-app-lib.ts';

const templateDir = fileURLToPath(new URL('../apps/template-app/', import.meta.url));
const values: NewAppValues = {
  name: "Rosa's Garden",
  slug: 'rosas-garden',
  iosBundleId: 'com.example.rosasgarden',
  androidBundleId: 'com.example.rosasgarden',
  colorLight: '#2F6B3A',
  colorDark: '#7FD08A',
  titleFont: { kind: 'bundled', key: 'newsreader' },
};

function walk(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(folder, entry.name)) : [relative(templateDir, join(folder, entry.name))],
  );
}

async function inTemporaryApps<T>(run: (appsRoot: string) => Promise<T>): Promise<T> {
  const appsRoot = mkdtempSync(join(tmpdir(), 'new-app-test-'));
  try {
    return await run(appsRoot);
  } finally {
    rmSync(appsRoot, { recursive: true, force: true });
  }
}

test('a new app gets its own validated settings, fonts file, and no template identity', async () => {
  await inTemporaryApps(async (appsRoot) => {
    const target = await scaffold({ appsRoot, templateDir, values });
    const settings = await loadSettings(join(target, 'app.settings.ts'));
    assert.equal(settings.name, "Rosa's Garden");
    assert.equal(settings.slug, 'rosas-garden');
    assert.deepEqual(settings.appColor, { light: '#2F6B3A', dark: '#7FD08A' });
    assert.equal(settings.modules.payments, false);
    assert.equal(settings.eas.owner, 'EAS_OWNER_PLACEHOLDER');
    assert.equal(settings.eas.projectId, 'EAS_PROJECT_ID_PLACEHOLDER');

    const template = await loadSettings(join(templateDir, 'app.settings.ts'));
    for (const file of walk(target)) {
      const text = readFileSync(join(target, file), file.endsWith('.ttf') ? 'latin1' : 'utf8');
      for (const leak of ['templateapp', 'template-app', 'Template App', template.eas.projectId, template.eas.owner]) {
        assert.equal(text.includes(leak), false, `${file} still contains ${leak}`);
      }
    }
    assert.equal(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name, 'rosas-garden');
    assert.match(readFileSync(join(target, 'app.json'), 'utf8'), /"scheme": "rosas-garden"/);
    assert.match(readFileSync(join(target, 'src/text/en.ts'), 'utf8'), /'feature\.title': 'Rosa\\'s Garden'/);
    assert.match(readFileSync(join(target, 'app.config.ts'), 'utf8'), /\.\.\.easUpdateConfig\(settings\.eas\)/);
    assert.equal(existsSync(join(target, 'assets/fonts/Newsreader-OFL.txt')), true);
    assert.equal(existsSync(join(target, 'eas.json')), false);
  });
});

test('a system title font writes no title font file', async () => {
  await inTemporaryApps(async (appsRoot) => {
    const target = await scaffold({ appsRoot, templateDir, values: { ...values, titleFont: { kind: 'system' } } });
    assert.equal((await loadSettings(join(target, 'app.settings.ts'))).fonts.title, 'system');
    assert.equal(readFileSync(join(target, 'src/fonts.ts'), 'utf8').includes('title:'), false);
    assert.equal(existsSync(join(target, 'assets/fonts/Newsreader28pt-Medium.ttf')), false);
  });
});

test('invalid settings, including low color contrast, create nothing', async () => {
  await inTemporaryApps(async (appsRoot) => {
    await assert.rejects(
      scaffold({ appsRoot, templateDir, values: { ...values, colorLight: '#F5F5F0' } }),
      /needs at least 3:1 contrast on the light background/,
    );
    await assert.rejects(scaffold({ appsRoot, templateDir, values: { ...values, iosBundleId: 'nope' } }), /bundleIds\.ios/);
    assert.deepEqual(readdirSync(appsRoot), []);
  });
});

test('an existing app folder is never overwritten', async () => {
  await inTemporaryApps(async (appsRoot) => {
    mkdirSync(join(appsRoot, values.slug));
    await assert.rejects(scaffold({ appsRoot, templateDir, values }), /already exists/);
    assert.deepEqual(readdirSync(join(appsRoot, values.slug)), []);
  });
});

test('the template fonts file is what renderFonts writes for the template settings', async () => {
  const template = await loadSettings(join(templateDir, 'app.settings.ts'));
  assert.equal(renderFonts(template.fonts), readFileSync(join(templateDir, 'src/fonts.ts'), 'utf8'));
});

test('the bundled font list matches the template fonts', async () => {
  const { fonts } = await loadSettings(join(templateDir, 'app.settings.ts'));
  assert.deepEqual(fonts, {
    title: { family: bundledFonts.newsreader.family, file: `./assets/fonts/${bundledFonts.newsreader.file}`, weight: bundledFonts.newsreader.weight },
    mono: { family: bundledFonts['ibm-plex-mono'].family, file: `./assets/fonts/${bundledFonts['ibm-plex-mono'].file}`, weight: bundledFonts['ibm-plex-mono'].weight },
  });
});

test('every template file is copied, written, generated, or deliberately left out', () => {
  const handled = (file: string) =>
    copiedFiles.includes(file) ||
    copiedFolders.some((folder) => file.startsWith(`${folder}/`)) ||
    ['app.settings.ts', 'src/fonts.ts', 'eas.json', 'LICENSE'].includes(file) ||
    file.startsWith('assets/fonts/') ||
    file.startsWith('assets/images/') ||
    file.startsWith('.vscode/');
  const ignored = (file: string) => /^(node_modules|\.expo)\//.test(file) || file === 'expo-env.d.ts';
  const unhandled = walk(templateDir).filter((file) => !ignored(file) && !handled(file));
  assert.deepEqual(unhandled, [], 'add these to copiedFiles/copiedFolders in scripts/new-app-lib.ts, or leave them out on purpose');
});

test('slugs come from names without accents or symbols', () => {
  assert.equal(slugFromName("Rosa's Garden"), 'rosas-garden');
  assert.equal(slugFromName('Çiçek Bahçesi!'), 'cicek-bahcesi');
});

test('a color is checked against its own background, with the same messages as the schema', () => {
  assert.deepEqual(appColorProblems('light', '#2F6B3A'), []);
  assert.match(appColorProblems('light', '#F5F5F0').join(), /needs at least 3:1 contrast on the light background/);
  assert.match(appColorProblems('dark', '#101010').join(), /needs at least 3:1 contrast on the dark background/);
});
