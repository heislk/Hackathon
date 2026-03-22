#!/usr/bin/env python3
"""
phone-intelligence/scripts/evaluate.py

Evaluates the saved SMS / smishing pipeline on the held-out test split.

Outputs:
  - precision / recall / F1 / accuracy / ROC AUC
  - confusion matrix
  - threshold sweep
  - per-source breakdown when the test split contains multiple corpora
  - a small misclassification sample for error review

This mirrors the email-intelligence workflow, but stays aligned with real SMS
data and the privacy-safe text representation used by train.py.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from common import counts_by_source, load_jsonl, resolve_data_dir, save_jsonl

logger = logging.getLogger(__name__)


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the phone-intelligence classifier.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=resolve_data_dir(),
        help="Base data directory containing splits and model output.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Override the stored decision threshold.",
    )
    parser.add_argument(
        "--errors-out",
        type=Path,
        default=None,
        help="Optional JSONL path for false positives / false negatives.",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("PHONE_INTELLIGENCE_LOG_LEVEL", "INFO"),
        help="Logging level.",
    )
    return parser.parse_args()


def metrics_for_predictions(y_true: list[int], y_pred: list[int], y_prob: list[float]) -> dict[str, float]:
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
    }
    try:
        metrics["roc_auc"] = roc_auc_score(y_true, y_prob)
    except Exception:
        metrics["roc_auc"] = 0.0
    return metrics


def threshold_sweep(y_true: list[int], y_prob: list[float]) -> list[dict[str, float]]:
    rows: list[dict[str, float]] = []
    for threshold in [i / 100 for i in range(5, 96, 5)]:
        preds = [1 if prob >= threshold else 0 for prob in y_prob]
        rows.append(
            {
                "threshold": threshold,
                "precision": precision_score(y_true, preds, zero_division=0),
                "recall": recall_score(y_true, preds, zero_division=0),
                "f1": f1_score(y_true, preds, zero_division=0),
            }
        )
    return rows


def evaluate_subset(
    records: list[dict],
    probabilities: list[float],
    threshold: float,
) -> dict[str, float]:
    y_true = [int(r["label"]) for r in records]
    y_pred = [1 if prob >= threshold else 0 for prob in probabilities]
    return metrics_for_predictions(y_true, y_pred, probabilities)


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)

    data_dir = args.data_dir
    splits_dir = data_dir / "splits"
    model_dir = data_dir / "model"
    test_path = splits_dir / "test.jsonl"
    model_path = model_dir / "phone_classifier.joblib"
    metadata_path = model_dir / "metadata.json"

    logger.info("=" * 72)
    logger.info("Phone Intelligence Evaluator")
    logger.info("=" * 72)

    if not test_path.exists():
        raise SystemExit(f"Test split not found at {test_path}. Run train.py first.")
    if not model_path.exists():
        raise SystemExit(f"Model not found at {model_path}. Run train.py first.")

    records = load_jsonl(test_path)
    if not records:
        raise SystemExit("Test split is empty.")

    pipeline = joblib.load(model_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    threshold = args.threshold if args.threshold is not None else float(metadata.get("threshold", 0.5))

    probabilities = [float(row[1]) for row in pipeline.predict_proba(records)]
    y_true = [int(r["label"]) for r in records]
    y_pred = [1 if prob >= threshold else 0 for prob in probabilities]

    metrics = metrics_for_predictions(y_true, y_pred, probabilities)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    logger.info("Using decision threshold: %.3f", threshold)
    logger.info("Overall metrics: %s", metrics)
    logger.info("\n%s", classification_report(
        y_true,
        y_pred,
        target_names=["Benign", "Malicious"],
        zero_division=0,
    ))
    logger.info("Confusion matrix")
    logger.info("  TN=%d  FP=%d", tn, fp)
    logger.info("  FN=%d  TP=%d", fn, tp)

    logger.info("Threshold sweep")
    for row in threshold_sweep(y_true, probabilities):
        logger.info(
            "  t=%.2f | precision=%.4f | recall=%.4f | f1=%.4f",
            row["threshold"],
            row["precision"],
            row["recall"],
            row["f1"],
        )

    source_counts = counts_by_source(records)
    if len(source_counts) > 1:
        logger.info("Per-source breakdown")
        for source, _count in sorted(source_counts.items(), key=lambda item: (-item[1], item[0])):
            subset = [record for record in records if str(record.get("source") or "unknown") == source]
            if not subset:
                continue
            subset_probs = [float(row[1]) for row in pipeline.predict_proba(subset)]
            subset_metrics = evaluate_subset(subset, subset_probs, threshold)
            logger.info("  %s -> %s", source, subset_metrics)

    errors: list[dict] = []
    for record, prob, pred in zip(records, probabilities, y_pred):
        if int(record["label"]) != pred:
            errors.append(
                {
                    "source": record.get("source", ""),
                    "true_label": int(record["label"]),
                    "predicted_label": pred,
                    "probability": prob,
                    "text_preview": record.get("text", "")[:240],
                    "sender": record.get("sender", ""),
                    "attack_type": record.get("attack_type", ""),
                }
            )

    logger.info("Misclassifications: %d", len(errors))
    for sample in errors[:5]:
        logger.info(
            "  %s | true=%s pred=%s prob=%.3f | %s",
            sample["source"],
            sample["true_label"],
            sample["predicted_label"],
            sample["probability"],
            sample["text_preview"],
        )

    if args.errors_out:
        save_jsonl(errors, args.errors_out)
        logger.info("Saved misclassifications to %s", args.errors_out)

    logger.info("=" * 72)


if __name__ == "__main__":
    main()
