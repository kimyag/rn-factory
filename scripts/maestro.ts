// `pnpm maestro [flow ...] [--app template-app] [--lang en] [--theme dark] [--server URL] [--preview]`
// Runs Maestro flows on one Android device against the dev server or an installed preview build.
// Screenshots go to maestro-screenshots/<app>/<time>/, which git ignores.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, networkInterfaces, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { connectedDevices, devClientLink, flowSkipReason, flowsIn, maestroArgs, parseArgs, paymentsActive, selectFlows } from './maestro-lib.ts';
import { prepareFlow } from './maestro-flow.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function lanAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return fail('No network address found. Pass the dev server with --server http://<address>:8081');
}

function maestroBinary(): string {
  const installed = join(homedir(), '.maestro', 'bin', 'maestro');
  const found = spawnSync('maestro', ['--version'], { stdio: 'ignore' });
  if (found.status === 0) {
    return 'maestro';
  }
  return existsSync(installed) ? installed : fail('Maestro is not installed. See docs/maestro.md.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const appDir = join(root, 'apps', options.app);
  if (!existsSync(appDir)) {
    fail(`No app folder apps/${options.app}`);
  }

  const imported: unknown = await import(pathToFileURL(join(appDir, 'app.settings.ts')).href);
  const settings = (imported as { default: {
    slug: string;
    bundleIds: { android: string };
    modules: { payments: boolean };
    payments: { revenueCatAndroidApiKey: string; revenueCatTestStoreApiKey: string };
  } }).default;
  const flows = selectFlows(
    [...flowsIn(join(root, 'maestro')), ...flowsIn(join(appDir, '.maestro'))],
    options.names,
  );
  if (flows.length === 0) {
    fail('No flows found in maestro/ or in the app\'s .maestro/ folder.');
  }

  const adb = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  if (adb.error) {
    fail('adb was not found. Install the Android platform tools and turn on USB debugging.');
  }
  const devices = connectedDevices(adb.stdout);
  if (devices.length !== 1) {
    fail(`Connect exactly one Android device with USB debugging (adb sees ${devices.length}).`);
  }

  const server = options.preview ? '' : options.server ?? `http://${lanAddress()}:8081`;
  if (options.preview) {
    const installed = spawnSync('adb', ['shell', 'pm', 'path', settings.bundleIds.android], { encoding: 'utf8' });
    if (!installed.stdout.includes('package:')) {
      fail(`No installed build for ${settings.bundleIds.android}. Install the app's preview build first.`);
    }
  } else {
    const status = await fetch(`${server}/status`).then((response) => response.text(), () => '');
    if (!status.includes('packager-status:running')) {
      fail(`The dev server is not running at ${server}. Start it: pnpm --filter ${options.app} start`);
    }
  }

  const stamp = new Date().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  const out = join(root, 'maestro-screenshots', options.app, stamp);
  mkdirSync(out, { recursive: true });
  const values = {
    appId: settings.bundleIds.android,
    link: options.preview ? '' : devClientLink(settings.slug, server),
    server,
    lang: options.lang,
    theme: options.theme,
  };
  const paymentsEnabled = paymentsActive(settings, !options.preview);

  const binary = maestroBinary();
  const results: [string, boolean][] = [];
  const configuredFlowDir = options.preview || flows.some((flow) => flow.name === 'settings' || flow.file.startsWith(`${join(appDir, '.maestro')}/`))
    ? mkdtempSync(join(tmpdir(), 'rn-factory-maestro-configured-'))
    : null;
  try {
    const runFlows = flows.map((flow) => {
      if (configuredFlowDir === null || (!options.preview && flow.name !== 'settings' && !flow.file.startsWith(`${join(appDir, '.maestro')}/`))) {
        return flow;
      }
      return prepareFlow(
        flow,
        join(root, 'maestro'),
        join(appDir, '.maestro'),
        configuredFlowDir,
        options.preview,
        paymentsEnabled,
      );
    });
    // A phone that goes to sleep shows a black screen to Maestro, so keep it awake while
    // it is charging over USB, and put the setting back afterwards.
    spawnSync('adb', ['shell', 'svc', 'power', 'stayon', 'usb']);
    try {
      for (const flow of runFlows) {
        const skipReason = flowSkipReason(flow.name, options.preview);
        if (skipReason !== null) {
          console.log(`SKIPPED ${flow.name}: ${skipReason}.`);
          continue;
        }
        console.log(`\n== ${flow.name} (${options.lang}, ${options.theme})`);
        spawnSync('adb', ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
        const run = spawnSync(binary, [
          ...maestroArgs(flow, values), '--test-output-dir', join(out, flow.name),
        ], { cwd: out, stdio: 'inherit' });
        results.push([flow.name, run.status === 0]);
        if (results.filter(([, passed]) => !passed).length >= 2) {
          console.error('Stopped after two failed flows. Remaining flows were not run.');
          break;
        }
      }
    } finally {
      spawnSync('adb', ['shell', 'svc', 'power', 'stayon', 'false']);
    }
  } finally {
    if (configuredFlowDir !== null) {
      rmSync(configuredFlowDir, { recursive: true, force: true });
    }
  }

  console.log(`\nScreenshots: ${out}`);
  for (const [name, passed] of results) {
    console.log(`${passed ? 'passed' : 'FAILED'}  ${name}`);
  }
  process.exit(results.every(([, passed]) => passed) ? 0 : 1);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
