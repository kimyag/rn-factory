#!/usr/bin/env python3
"""Summarize Android FrameTimeline and scheduler data from one Perfetto trace."""

import json
import math
import re
import sys
from contextlib import redirect_stdout
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any


APP_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$")


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def summarize(
    frames: Iterable[Mapping[str, Any]], cpu_ns: int, trace_start_ns: int, trace_end_ns: int
) -> dict[str, Any]:
    rows = sorted(frames, key=lambda frame: int(frame["ts"]))
    timestamps = [int(frame["ts"]) for frame in rows]
    intervals_ms = [(right - left) / 1_000_000 for left, right in zip(timestamps, timestamps[1:])]
    duration_ns = max(0, trace_end_ns - trace_start_ns)
    frame_count = len(rows)
    janky_frames = sum(bool(frame["janky"]) for frame in rows)
    average_fps = None
    if len(timestamps) > 1 and timestamps[-1] > timestamps[0]:
        average_fps = round((len(timestamps) - 1) * 1_000_000_000 / (timestamps[-1] - timestamps[0]), 2)

    return {
        "frame_count": frame_count,
        "average_fps": average_fps,
        "janky_frames": janky_frames,
        "jank_percent": round(janky_frames * 100 / frame_count, 2) if frame_count else None,
        "frame_interval_ms_p50": round(percentile(intervals_ms, 0.5), 2) if intervals_ms else None,
        "frame_interval_ms_p95": round(percentile(intervals_ms, 0.95), 2) if intervals_ms else None,
        "cpu_ms": round(cpu_ns / 1_000_000, 2),
        "cpu_percent_one_core": round(cpu_ns * 100 / duration_ns, 2) if duration_ns else None,
        "trace_duration_ms": round(duration_ns / 1_000_000, 2),
    }


def frame_timeline_query(app_id: str) -> str:
    app_literal = app_id.replace("'", "''")
    return f"""
        SELECT surface_frame_token,
               MIN(ts) AS ts,
               MAX(CASE WHEN jank_type IS NOT NULL AND jank_type != 'None' THEN 1 ELSE 0 END) AS janky
        FROM actual_frame_timeline_slice
        WHERE instr(layer_name, '{app_literal}') > 0
          AND layer_name NOT LIKE '%Splash Screen%'
          AND surface_frame_token IS NOT NULL
        GROUP BY surface_frame_token
        ORDER BY ts
        """


def analyze(trace_path: Path, app_id: str) -> dict[str, Any]:
    if not APP_ID_PATTERN.fullmatch(app_id):
        raise ValueError(f"Invalid Android application ID: {app_id}")
    app_literal = app_id.replace("'", "''")

    # The package pins the matching Trace Processor binary; do not fetch latest.
    from perfetto.trace_processor import TraceProcessor

    with TraceProcessor(trace=str(trace_path)) as processor:
        frames = [
            {"ts": row.ts, "janky": row.janky}
            for row in processor.query(frame_timeline_query(app_id))
        ]
        cpu_rows = list(
            processor.query(
                f"""
                SELECT COALESCE(SUM(sched_slice.dur), 0) AS cpu_ns
                FROM sched_slice
                JOIN thread USING (utid)
                JOIN process USING (upid)
                WHERE (process.name = '{app_literal}' OR process.name GLOB '{app_literal}:*')
                  AND sched_slice.dur > 0
                """
            )
        )
        bounds = list(processor.query("SELECT start_ts, end_ts FROM trace_bounds"))
        if not bounds:
            raise ValueError("Perfetto trace has no time bounds.")
        cpu_ns = int(cpu_rows[0].cpu_ns or 0) if cpu_rows else 0
        return summarize(frames, cpu_ns, int(bounds[0].start_ts), int(bounds[0].end_ts))


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--prepare":
        try:
            with redirect_stdout(sys.stderr):
                prepare_trace_processor()
        except Exception as error:  # The CLI should provide a useful setup error.
            sys.stderr.write(f"Pinned Perfetto Trace Processor setup failed: {error}\n")
            return 1
        sys.stderr.write("Pinned Perfetto Trace Processor is ready.\n")
        return 0
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python3 scripts/perfetto_report.py --prepare | <trace.pftrace> <android-app-id>\n")
        return 2
    try:
        with redirect_stdout(sys.stderr):
            result = analyze(Path(sys.argv[1]), sys.argv[2])
    except Exception as error:  # The CLI should report a useful error and preserve the raw trace.
        sys.stderr.write(f"Perfetto report failed: {error}\n")
        return 1
    sys.stdout.write(f"{json.dumps(result, sort_keys=True)}\n")
    return 0


def prepare_trace_processor() -> str:
    from perfetto.prebuilts.manifests.trace_processor_shell import TRACE_PROCESSOR_SHELL_MANIFEST
    from perfetto.prebuilts.perfetto_prebuilts import get_perfetto_prebuilt

    return get_perfetto_prebuilt(TRACE_PROCESSOR_SHELL_MANIFEST)


if __name__ == "__main__":
    raise SystemExit(main())
