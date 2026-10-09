import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { Flow } from './maestro-lib.ts';

const appIdPattern = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/;

export function validateAppId(appId: string): void {
  if (!appIdPattern.test(appId)) {
    throw new Error(`Invalid Android application ID: ${appId}`);
  }
}

export function traceConfig(appId: string, durationMs = 180_000): string {
  validateAppId(appId);
  return `duration_ms: ${durationMs}
write_into_file: true
file_write_period_ms: 5000
buffers { size_kb: 32768 fill_policy: RING_BUFFER }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      compact_sched { enabled: true }
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_waking"
    }
  }
}
data_sources {
  config {
    name: "linux.process_stats"
    process_stats_config { scan_all_processes_on_start: true proc_stats_poll_ms: 1000 }
  }
}
`;
}

function copyMissing(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    const from = join(source, name);
    const to = join(destination, name);
    if (!existsSync(to)) {
      cpSync(from, to, { recursive: true });
    } else if (statSync(from).isDirectory() && statSync(to).isDirectory()) {
      copyMissing(from, to);
    }
  }
}

export function releaseFlow(flow: Flow, sharedFlowsDir: string, appFlowsDir: string, outputDir: string): string {
  cpSync(sharedFlowsDir, outputDir, { recursive: true });
  const isAppFlow = flow.file.startsWith(`${appFlowsDir}/`);
  if (isAppFlow) {
    copyMissing(appFlowsDir, outputDir);
  }

  const source = readFileSync(flow.file, 'utf8');
  const startup = source.replace(/^- runFlow: subflows\/start\.yaml\s*$/gm, '- runFlow: subflows/perf-start.yaml');
  if (startup === source && /DEV_CLIENT_LINK|SERVER_URL/.test(source)) {
    throw new Error(`${flow.name} depends on the development client; add the standard subflows/start.yaml call to use the release performance runner.`);
  }

  const target = join(outputDir, basename(flow.file));
  writeFileSync(target, startup);
  return target;
}

export function traceCommands(key: string, remoteTrace: string): { start: string[]; stop: string[] } {
  return {
    start: ['shell', 'perfetto', '-c', '-', '--txt', `--detach=${key}`, '-o', remoteTrace],
    stop: ['shell', 'perfetto', `--attach=${key}`, '--stop'],
  };
}
