#!/usr/bin/env python3
"""
phone-intelligence/scripts/train.py

Trains a privacy-safe SMS / smishing classifier on the real corpus prepared by
download_dataset.py.

Model choice:
  - scikit-learn logistic regression
  - combined word and character TF-IDF features
  - message and sender signal tokens derived from the raw text

Why this design:
  - works in the current environment without torch/transformers
  - performs well on short, noisy mobile-message text
  - supports both copy/paste text and OCR-processed phone screenshots later
  - keeps the model focused on message content rather than raw PII

Training flow:
  1. load the combined JSONL corpus
  2. deduplicate by sanitized text + label
  3. stratify into train / validation / test splits
  4. fit the text classifier on the train split
  5. pick a validation threshold that maximizes F1
  6. save the pipeline, threshold, and split files
  7. report final held-out test metrics
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from dataclasses import asdict
from pathlib import Path

import joblib
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score, roc_auc_score

from common import (
    PipelineConfig,
    build_pipeline,
    canonical_label,
    counts_by_label,
    dedupe_records,
    ensure_dir,
    load_jsonl,
    resolve_data_dir,
    save_jsonl,
    stratified_split,
)

logger = logging.getLogger(__name__)


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the phone-intelligence SMS classifier.")
    parser.add_argument(
        "--data-file",
        type=Path,
        default=None,
        help="Combined JSONL corpus path. Defaults to processed/sms_corpus.jsonl.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=resolve_data_dir(),
        help="Base data directory for splits and model output.",
    )
    parser.add_argument("--train-ratio", type=float, default=0.80)
    parser.add_argument("--val-ratio", type=float, default=0.10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--word-min-df", type=int, default=2)
    parser.add_argument("--char-min-df", type=int, default=2)
    parser.add_argument("--word-max-features", type=int, default=35000)
    parser.add_argument("--char-max-features", type=int, default=45000)
    parser.add_argument("--classifier-c", type=float, default=4.0)
    parser.add_argument("--max-iter", type=int, default=4000)
    parser.add_argument("--threshold-min", type=float, default=0.05)
    parser.add_argument("--threshold-max", type=float, default=0.95)
    parser.add_argument("--threshold-step", type=float, default=0.01)
    parser.add_argument(
        "--log-level",
        default=os.getenv("PHONE_INTELLIGENCE_LOG_LEVEL", "INFO"),
        help="Logging level.",
    )
    return parser.parse_args()


def choose_threshold(y_true: list[int], probabilities: list[float], start: float, stop: float, step: float) -> tuple[float, dict[str, float]]:
    if not y_true:
        return 0.5, {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "roc_auc": 0.0}

    best_threshold = 0.5
    best_metrics = {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "roc_auc": 0.0}
    best_score = -1.0

    thresholds: list[float] = []
    current = start
    while current <= stop + 1e-9:
        thresholds.append(round(current, 4))
        current += step
    if 0.5 not in thresholds:
        thresholds.append(0.5)
    thresholds = sorted(set(thresholds))

    for threshold in thresholds:
        preds = [1 if prob >= threshold else 0 for prob in probabilities]
        metrics = {
            "accuracy": accuracy_score(y_true, preds),
            "precision": precision_score(y_true, preds, zero_division=0),
            "recall": recall_score(y_true, preds, zero_division=0),
            "f1": f1_score(y_true, preds, zero_division=0),
        }
        try:
            metrics["roc_auc"] = roc_auc_score(y_true, probabilities)
        except Exception:
            metrics["roc_auc"] = 0.0

        score = metrics["f1"]
        if score > best_score:
            best_score = score
            best_threshold = threshold
            best_metrics = metrics

    return best_threshold, best_metrics


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


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)

    data_dir = args.data_dir
    processed_dir = data_dir / "processed"
    splits_dir = data_dir / "splits"
    model_dir = data_dir / "model"
    corpus_path = args.data_file or (processed_dir / "sms_corpus.jsonl")
    metadata_path = model_dir / "metadata.json"
    model_path = model_dir / "phone_classifier.joblib"

    logger.info("=" * 72)
    logger.info("Phone Intelligence Trainer")
    logger.info("=" * 72)
    logger.info("Corpus       : %s", corpus_path)
    logger.info("Model output : %s", model_dir)

    if not corpus_path.exists():
        raise SystemExit(
            f"Training corpus not found at {corpus_path}. Run download_dataset.py first."
        )

    records = load_jsonl(corpus_path)
    records = dedupe_records(records)
    records = [record for record in records if canonical_label(record.get("label")) in (0, 1) and record.get("text")]

    if len(records) < 20:
        raise SystemExit("Not enough records to train a useful classifier.")

    logger.info("Loaded %d records after dedupe", len(records))
    logger.info("Label counts : %s", counts_by_label(records))

    train_records, val_records, test_records = stratified_split(
        records,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        seed=args.seed,
    )

    for split_dir in (splits_dir, model_dir, processed_dir):
        ensure_dir(split_dir)

    save_jsonl(train_records, splits_dir / "train.jsonl")
    save_jsonl(val_records, splits_dir / "val.jsonl")
    save_jsonl(test_records, splits_dir / "test.jsonl")

    logger.info(
        "Split sizes -> train: %d | val: %d | test: %d",
        len(train_records),
        len(val_records),
        len(test_records),
    )

    config = PipelineConfig(
        word_min_df=args.word_min_df,
        char_min_df=args.char_min_df,
        word_max_features=args.word_max_features,
        char_max_features=args.char_max_features,
        classifier_c=args.classifier_c,
        max_iter=args.max_iter,
        random_seed=args.seed,
    )
    pipeline = build_pipeline(config)

    logger.info("Fitting classifier...")
    pipeline.fit(train_records, [int(r["label"]) for r in train_records])

    val_probabilities = [float(p[1]) for p in pipeline.predict_proba(val_records)]
    best_threshold, val_metrics = choose_threshold(
        [int(r["label"]) for r in val_records],
        val_probabilities,
        start=args.threshold_min,
        stop=args.threshold_max,
        step=args.threshold_step,
    )

    val_predictions = [1 if prob >= best_threshold else 0 for prob in val_probabilities]
    val_final_metrics = metrics_for_predictions(
        [int(r["label"]) for r in val_records],
        val_predictions,
        val_probabilities,
    )

    logger.info("Validation threshold chosen at %.3f", best_threshold)
    logger.info("Validation metrics: %s", val_final_metrics)

    test_probabilities = [float(p[1]) for p in pipeline.predict_proba(test_records)]
    test_predictions = [1 if prob >= best_threshold else 0 for prob in test_probabilities]
    test_metrics = metrics_for_predictions(
        [int(r["label"]) for r in test_records],
        test_predictions,
        test_probabilities,
    )

    logger.info("Test metrics: %s", test_metrics)
    logger.info("\n%s", classification_report(
        [int(r["label"]) for r in test_records],
        test_predictions,
        target_names=["Benign", "Malicious"],
        zero_division=0,
    ))

    joblib.dump(pipeline, model_path)
    metadata = {
        "model_version": "sklearn-smishing-v1",
        "model_format": "joblib",
        "threshold": best_threshold,
        "config": asdict(config),
        "corpus_path": str(corpus_path),
        "train_count": len(train_records),
        "val_count": len(val_records),
        "test_count": len(test_records),
        "label_counts": counts_by_label(records),
        "validation_metrics": val_final_metrics,
        "test_metrics": test_metrics,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    logger.info("Saved model to %s", model_path)
    logger.info("Saved metadata to %s", metadata_path)
    logger.info("=" * 72)


if __name__ == "__main__":
    main()
