# Android performance runs

Use one repeatable Maestro flow with Perfetto to record frame timing and app CPU
on a real Android phone. This is a local measurement command; it does not build,
install, publish, or upload an app or trace.

## Setup

The phone must be free, connected by USB debugging, and the only device shown by
`adb devices`. FrameTimeline requires Android 12 (API 31) or newer. Install the
app's standalone release build first; the development client and Metro server
are intentionally not used. Install Maestro as described in
[maestro.md](maestro.md), plus Python 3.10+ and the pinned Perfetto Trace
Processor:

```sh
python3 -m venv .venv-performance
. .venv-performance/bin/activate
python -m pip install -r requirements-performance.txt
```

The exact `perfetto` Python package version pins the matching Trace Processor;
the report never fetches a newer binary. CI exercises flow preparation and
metric calculations without installing the processor or building a native app.

## Run

```sh
pnpm perf:maestro settings
pnpm perf:maestro onboarding-pages --app my-app --lang en --theme dark
```

Run one flow per command. The runner creates a temporary copy of the flow that
launches the installed app directly, starts a bounded 180-second Perfetto trace,
runs Maestro once, then stops and pulls the trace. It does not retry a failed
flow. Traces and reports go to the ignored
`maestro-screenshots/performance/<app>/<flow>/<timestamp>/` directory. Keep
traces local: they can contain process, package, and system scheduling data.

The trace covers process startup through the end of the flow, rather than only
the time spent in Maestro steps. `average_fps` uses app FrameTimeline frame
timestamps. `frame_interval_ms_p50` and `frame_interval_ms_p95` describe the
gaps between those frames. `jank_percent` counts app frames with any reported
FrameTimeline jank type; system load can contribute to jank. `cpu_ms` sums
scheduled CPU time for the app process and its subprocesses over the trace.
`cpu_percent_one_core` divides that time by the total trace duration, where
100% means one core was busy throughout. Missing frame data is reported as
`null`; this can happen when the device does not expose FrameTimeline data.

Use the same device, build type, flow, and initial app state when comparing
changes. These measurements help compare runs; they are not a device-independent
benchmark.
