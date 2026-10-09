import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { releaseFlow, traceCommands, traceConfig, validateAppId } from './perf-maestro-lib.ts';

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

test('release flow swaps the dev-client startup for the standalone app launcher', () => {
  const temp = mkdtempSync(join(tmpdir(), 'maestro-perf-test-'));
  try {
    const shared = join(temp, 'shared');
    const app = join(temp, 'app');
    const output = join(temp, 'output');
    mkdirSync(join(shared, 'subflows'), { recursive: true });
    mkdirSync(app, { recursive: true });
    writeFileSync(join(shared, 'subflows', 'perf-start.yaml'), 'release start');
    writeFileSync(join(shared, 'settings.yaml'), 'appId: ${APP_ID}\n---\n- runFlow: subflows/start.yaml\n- takeScreenshot: settings');
    const flow = { name: 'settings', file: join(shared, 'settings.yaml') };

    const result = releaseFlow(flow, shared, app, output);
    const contents = readFileSync(result, 'utf8');
    assert.match(contents, /runFlow: subflows\/perf-start\.yaml/);
    assert.doesNotMatch(contents, /runFlow: subflows\/start\.yaml/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
