import unittest

from perfetto_report import summarize


class SummarizeTest(unittest.TestCase):
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
