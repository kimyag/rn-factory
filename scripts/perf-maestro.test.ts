import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { preparePerformanceFlow } from './maestro-flow.ts';
import { traceCommands, traceConfig, validateAppId } from './perf-maestro-lib.ts';

test('trace settings include FrameTimeline and bounded CPU scheduling sources', () => {
  const config = traceConfig('com.example.app');
  assert.match(config, /duration_ms: 180000/);
  assert.match(config, /android\.surfaceflinger\.frametimeline/);
  assert.match(config, /sched\/sched_switch/);
  assert.match(config, /linux\.process_stats/);
  assert.throws(() => traceConfig('not-an-application-id'), /Invalid Android application ID/);
});

test('Perfetto start and stop use one detached session key', () => {
  const commands = traceCommands('rn-factory-run', '/data/local/tmp/run.pftrace');
  assert.deepEqual(commands.start, ['shell', 'perfetto', '-c', '-', '--txt', '--detach=rn-factory-run', '-o', '/data/local/tmp/run.pftrace']);
  assert.deepEqual(commands.stop, ['shell', 'perfetto', '--attach=rn-factory-run', '--stop']);
});

test('Android package IDs must be valid dotted identifiers', () => {
  assert.doesNotThrow(() => validateAppId('com.example.app'));
  assert.throws(() => validateAppId('invalid'), /Invalid Android application ID/);
});

test('performance settings prepare with payment assertions hidden', () => {
  const root = join(import.meta.dirname, '..');
  const shared = join(root, 'maestro');
  const app = join(root, 'apps/template-app/.maestro');
  const output = mkdtempSync(join(tmpdir(), 'perf-maestro-settings-test-'));
  try {
    const flow = { name: 'settings', file: join(shared, 'settings.yaml') };
    const prepared = preparePerformanceFlow(flow, shared, app, output);
    const contents = readFileSync(prepared.file, 'utf8');
    assert.match(contents, /settings-payments-inactive\.yaml/);
    assert.doesNotMatch(contents, /settings-payments-active\.yaml|settings-payments-check\.yaml/);
    assert.match(contents, /preview-start\.yaml/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
