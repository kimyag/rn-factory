// Writes apps/<app>/eas.json from each app's app.settings.ts.
// --check: write nothing and exit 1 if any eas.json is out of date.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { easConfig, validateSettings } from '../packages/core/src/index.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const { packageManager } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pnpmVersion = String(packageManager).replace(/^pnpm@/, '');

const outdated: string[] = [];

for (const app of readdirSync(join(root, 'apps'))) {
  const settingsFile = join(root, 'apps', app, 'app.settings.ts');
  if (!existsSync(settingsFile)) {
    continue;
  }
  const { default: settings } = await import(pathToFileURL(settingsFile).href);
  const json = `${JSON.stringify(easConfig(validateSettings(settings), pnpmVersion), null, 2)}\n`;
  const target = join(root, 'apps', app, 'eas.json');
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';

  if (current === json) {
    continue;
  }
  if (check) {
    outdated.push(`apps/${app}/eas.json`);
  } else {
    writeFileSync(target, json);
    process.stdout.write(`wrote apps/${app}/eas.json\n`);
  }
}

if (outdated.length > 0) {
  process.stderr.write(`Out of date (run pnpm eas:config): ${outdated.join(', ')}\n`);
  process.exit(1);
}
