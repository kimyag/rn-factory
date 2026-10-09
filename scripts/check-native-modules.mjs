import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const appsRoot = join(root, 'apps');
const apps = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((app) => {
    try {
      return Boolean(JSON.parse(readFileSync(join(appsRoot, app, 'package.json'), 'utf8')).dependencies?.expo);
    } catch {
      return false;
    }
  });

let failed = false;
for (const app of apps) {
  for (const platform of ['android', 'apple']) {
    const result = spawnSync('pnpm', ['exec', 'expo-modules-autolinking', 'resolve', '--platform', platform], {
      cwd: join(appsRoot, app),
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      process.stderr.write(`${app} ${platform} autolinking failed:\n${result.stderr || result.stdout}`);
      failed = true;
    }
  }
  process.stdout.write(`Resolved native modules for apps/${app}.\n`);
}

process.exit(failed ? 1 : 0);
