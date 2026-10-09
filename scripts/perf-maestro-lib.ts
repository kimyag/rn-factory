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

export function traceCommands(key: string, remoteTrace: string): { start: string[]; stop: string[] } {
  return {
    start: ['shell', 'perfetto', '-c', '-', '--txt', `--detach=${key}`, '-o', remoteTrace],
    stop: ['shell', 'perfetto', `--attach=${key}`, '--stop'],
  };
}
