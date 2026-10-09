import json
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from unittest.mock import patch

from perfetto_report import frame_timeline_query, main, summarize


class SummarizeTest(unittest.TestCase):
    def test_frame_query_matches_app_layer_not_surfaceflinger_process_name(self):
        query = frame_timeline_query('com.example.app')
        self.assertIn("instr(layer_name, 'com.example.app') > 0", query)
        self.assertNotIn('JOIN process', query)
        self.assertIn('surface_frame_token IS NOT NULL', query)

    def test_processor_logs_do_not_contaminate_report_json(self):
        stdout = StringIO()
        stderr = StringIO()

        def noisy_analysis(_trace, _app_id):
            print('Downloading pinned Trace Processor')
            return {"frame_count": 0}

        with patch.object(sys, 'argv', ['perfetto_report.py', 'trace.pftrace', 'com.example.app']):
            with patch('perfetto_report.analyze', side_effect=noisy_analysis):
                with redirect_stdout(stdout), redirect_stderr(stderr):
                    self.assertEqual(main(), 0)

        self.assertEqual(json.loads(stdout.getvalue()), {"frame_count": 0})
        self.assertIn('Downloading pinned Trace Processor', stderr.getvalue())

    def test_prepare_download_logs_do_not_use_stdout(self):
        stdout = StringIO()
        stderr = StringIO()

        def noisy_prepare():
            print('Downloading pinned Trace Processor')
            return '/tmp/trace_processor_shell'

        with patch.object(sys, 'argv', ['perfetto_report.py', '--prepare']):
            with patch('perfetto_report.prepare_trace_processor', side_effect=noisy_prepare):
                with redirect_stdout(stdout), redirect_stderr(stderr):
                    self.assertEqual(main(), 0)

        self.assertEqual(stdout.getvalue(), '')
        self.assertIn('Downloading pinned Trace Processor', stderr.getvalue())

    def test_reports_average_fps_jank_percentiles_and_one_core_cpu(self):
        result = summarize(
            [
                {"ts": 0, "janky": 0},
                {"ts": 16_000_000, "janky": 1},
                {"ts": 48_000_000, "janky": 0},
            ],
            cpu_ns=90_000_000,
            trace_start_ns=0,
            trace_end_ns=100_000_000,
        )
        self.assertEqual(result["frame_count"], 3)
        self.assertEqual(result["average_fps"], 41.67)
        self.assertEqual(result["jank_percent"], 33.33)
        self.assertEqual(result["frame_interval_ms_p50"], 24.0)
        self.assertEqual(result["frame_interval_ms_p95"], 31.2)
        self.assertEqual(result["cpu_ms"], 90.0)
        self.assertEqual(result["cpu_percent_one_core"], 90.0)

    def test_missing_frames_are_reported_as_unavailable(self):
        result = summarize([], cpu_ns=0, trace_start_ns=10, trace_end_ns=10)
        self.assertIsNone(result["average_fps"])
        self.assertIsNone(result["jank_percent"])
        self.assertIsNone(result["cpu_percent_one_core"])


if __name__ == "__main__":
    unittest.main()
