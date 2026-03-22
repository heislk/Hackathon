from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    PipelineConfig,
    build_pipeline,
    compose_model_text,
    parse_moz_row,
    parse_uci_line,
    stratified_split,
)


class CommonHelpersTest(unittest.TestCase):
    def test_parse_uci_line_maps_spam_to_positive(self) -> None:
        record = parse_uci_line("spam\tFree entry in a wkly comp to win tickets now")
        self.assertIsNotNone(record)
        self.assertEqual(record["label"], 1)
        self.assertEqual(record["source"], "uci_sms_spam_collection")

    def test_parse_moz_row_filters_to_sms_and_maps_labels(self) -> None:
        row = {
            "id": "1_0",
            "source": "sms",
            "text": "Bom dia, confirme o codigo agora",
            "label": "Smishing",
        }
        record = parse_moz_row(row)
        self.assertIsNotNone(record)
        self.assertEqual(record["label"], 1)
        self.assertEqual(record["source"], "moz_smishing_sms")

    def test_compose_model_text_adds_privacy_safe_feature_tokens(self) -> None:
        text = compose_model_text(
            {
                "text": "Urgent! Verify your account at https://bit.ly/example",
                "sender": "+15551234567",
            }
        )
        self.assertIn("has_url", text)
        self.assertIn("has_urgency", text)
        self.assertIn("has_shortener", text)
        self.assertIn("sender_present", text)
        self.assertIn("sender_longcode", text)

    def test_stratified_split_preserves_both_labels(self) -> None:
        records = []
        for i in range(10):
            records.append({"text": f"ham {i}", "label": 0, "source": "uci"})
            records.append({"text": f"spam {i}", "label": 1, "source": "uci"})

        train, val, test = stratified_split(records, seed=7)
        self.assertGreater(len(train), 0)
        self.assertGreater(len(val), 0)
        self.assertGreater(len(test), 0)
        self.assertTrue(any(r["label"] == 0 for r in train))
        self.assertTrue(any(r["label"] == 1 for r in train))

    def test_pipeline_smoke_fit_and_predict(self) -> None:
        records = [
            {"text": "Free entry in a weekly competition now", "label": 1, "source": "uci"},
            {"text": "Your account is locked, verify now", "label": 1, "source": "uci"},
            {"text": "Hey, are we still on for lunch today?", "label": 0, "source": "uci"},
            {"text": "Thanks, I'll call you after work", "label": 0, "source": "uci"},
            {"text": "Claim your prize, click the link now", "label": 1, "source": "uci"},
            {"text": "The meeting moved to 3pm", "label": 0, "source": "uci"},
        ]

        pipeline = build_pipeline(
            PipelineConfig(
                word_min_df=1,
                char_min_df=1,
                word_max_features=1000,
                char_max_features=1000,
                max_iter=200,
            )
        )
        pipeline.fit(records, [r["label"] for r in records])
        probabilities = pipeline.predict_proba(records)
        predictions = pipeline.predict(records)

        self.assertEqual(len(probabilities), len(records))
        self.assertEqual(len(predictions), len(records))
        self.assertTrue(all(pred in (0, 1) for pred in predictions))


if __name__ == "__main__":
    unittest.main()
