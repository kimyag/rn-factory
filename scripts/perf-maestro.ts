import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { connectedDevices, flowsIn, maestroArgs, parseArgs, selectFlows } from './maestro-lib.ts';
import { preparePerformanceFlow } from './maestro-flow.ts';
import { traceCommands, traceConfig, validateAppId } from './perf-maestro-lib.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function checked(command: string, args: string[], input?: string) {
  const result = spawnSync(command, args, { encoding: 'utf8', input });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}

function maestroBinary(): string {
  const installed = join(homedir(), '.maestro', 'bin', 'maestro');
  if (spawnSync('maestro', ['--version'], { stdio: 'ignore' }).status === 0) {
    return 'maestro';
  }
  return existsSync(installed) ? installed : fail('Maestro is not installed. See docs/maestro.md.');
}

function pythonBinary(): string {
  for (const binary of ['python3', 'python']) {
    if (spawnSync(binary, ['--version'], { stdio: 'ignore' }).status === 0) {
      return binary;
    }
  }
  return fail('Python 3 is required. See docs/performance.md to install the pinned Perfetto Trace Processor.');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (options.names.length !== 1 || options.server !== null) {
    fail('Run exactly one flow: pnpm perf:maestro <flow> [--app <app>] [--lang en] [--theme dark]. This command uses an installed release build and no dev server.');
  }

  const appDir = join(root, 'apps', options.app);
  if (!existsSync(appDir)) {
    fail(`No app folder apps/${options.app}`);
  }
  const imported: unknown = await import(pathToFileURL(join(appDir, 'app.settings.ts')).href);
  const settings = (imported as { default: { slug: string; bundleIds: { android: string } } }).default;
  const appId = settings.bundleIds.android;
  validateAppId(appId);

  const sharedDir = join(root, 'maestro');
  const appFlowsDir = join(appDir, '.maestro');
  const flow = selectFlows([...flowsIn(sharedDir), ...flowsIn(appFlowsDir)], options.names)[0];
  if (!flow) {
    fail('The requested flow was not found.');
  }

  const devices = connectedDevices(checked('adb', ['devices']));
  if (devices.length !== 1) {
    fail(`Connect exactly one Android device with USB debugging (adb sees ${devices.length}).`);
  }
  const apiLevel = Number(checked('adb', ['shell', 'getprop', 'ro.build.version.sdk']));
  if (!Number.isInteger(apiLevel) || apiLevel < 31) {
    fail(`Unsupported Android API ${apiLevel || 'unknown'}: FrameTimeline requires Android 12/API 31+, and this runner has no frame-metric fallback for older versions.`);
  }
  if (!checked('adb', ['shell', 'pm', 'path', appId]).includes('package:')) {
    fail(`Install a standalone release build for ${appId} first. Do not use the development client for performance measurements.`);
  }

  const python = pythonBinary();
  const processorSetup = spawnSync(python, ['scripts/perfetto_report.py', '--prepare'], { cwd: root, encoding: 'utf8' });
  if (processorSetup.error || processorSetup.status !== 0) {
    fail(`Pinned Perfetto Trace Processor setup failed: ${processorSetup.error?.message ?? processorSetup.stderr ?? processorSetup.stdout}`);
  }
  if (processorSetup.stderr.trim()) {
    process.stderr.write(`${processorSetup.stderr.trim()}\n`);
  }

  const stamp = new Date().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  const out = join(root, 'maestro-screenshots', 'performance', options.app, flow.name, stamp);
  mkdirSync(out, { recursive: true });
  const flowDir = mkdtempSync(join(tmpdir(), 'rn-factory-maestro-perf-'));
  const releaseFlowFile = preparePerformanceFlow(flow, sharedDir, appFlowsDir, flowDir).file;
  const key = `rn-factory-${stamp}`;
  const remoteTrace = `/data/misc/perfetto-traces/${key}.pftrace`;
  const trace = join(out, `${flow.name}.pftrace`);
  const commands = traceCommands(key, remoteTrace);
  const binary = maestroBinary();
  let traceStarted = false;
  let flowPassed = false;
  let runError: unknown;

  try {
    checked('adb', commands.start, traceConfig(appId));
    traceStarted = true;
    checked('adb', ['shell', 'svc', 'power', 'stayon', 'usb']);
    const run = spawnSync(binary, maestroArgs(flow, {
      appId,
      link: '',
      server: '',
      lang: options.lang,
      theme: options.theme,
    }).map((arg) => (arg === flow.file ? releaseFlowFile : arg)), { cwd: out, stdio: 'inherit' });
    flowPassed = run.status === 0;
    if (run.error) {
      throw run.error;
    }
  } catch (error) {
    runError = error;
  } finally {
    try {
      if (traceStarted) {
        checked('adb', commands.stop);
        checked('adb', ['pull', remoteTrace, trace]);
        checked('adb', ['shell', 'rm', '-f', remoteTrace]);
      }
    } catch (error) {
      runError ??= error;
    } finally {
      try {
        checked('adb', ['shell', 'svc', 'power', 'stayon', 'false']);
      } catch (error) {
        runError ??= error;
      }
      rmSync(flowDir, { recursive: true, force: true });
    }
  }
  if (runError) {
    throw runError;
  }

  const report = spawnSync(python, ['scripts/perfetto_report.py', trace, appId], { cwd: root, encoding: 'utf8' });
  if (report.error || report.status !== 0) {
    fail(`Perfetto analysis failed: ${report.error?.message ?? report.stderr ?? report.stdout}`);
  }
  const metrics: unknown = JSON.parse(report.stdout);
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  process.stdout.write(`\n${JSON.stringify(metrics, null, 2)}\nTrace: ${trace}\nReport: ${join(out, 'report.json')}\n`);
  if (!flowPassed) {
    fail(`Maestro flow ${flow.name} failed. The flow was run once; no retry was attempted.`);
  }
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
