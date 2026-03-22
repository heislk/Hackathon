#!/usr/bin/env python3
"""
email-intelligence/scripts/evaluate.py

Evaluates the fine-tuned DistilBERT phishing classifier on the held-out test set.

Generates:
  - Precision / Recall / F1 (per class and macro)
  - Confusion matrix
  - ROC AUC
  - Threshold analysis (shows precision/recall at different cut-offs)
  - Sample misclassified emails (for error analysis — shown redacted)

USAGE:
  cd email-intelligence
  python scripts/evaluate.py

  The test split (data/splits/test.jsonl) must exist — run train.py first.
  Target: F1 ≥ 0.92 on the mixed phishing + ham test set.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT  = Path(__file__).parent.parent
SPLITS_DIR = REPO_ROOT / "data/splits"
MODEL_DIR  = REPO_ROOT / os.getenv("MODEL_DIR", "model")
sys.path.insert(0, str(REPO_ROOT))


def main():
    logger.info("=" * 60)
    logger.info("DistilBERT Phishing Classifier — Evaluation")
    logger.info("=" * 60)

    test_file = SPLITS_DIR / "test.jsonl"
    if not test_file.exists():
        logger.error(
            "Test split not found at %s. Run 'python scripts/train.py' first.",
            test_file
        )
        sys.exit(1)

    # ── Load test split ────────────────────────────────────────────────────────
    with test_file.open() as f:
        test_records = [json.loads(line) for line in f if line.strip()]
    logger.info("Loaded %d test samples", len(test_records))

    # ── Load model ────────────────────────────────────────────────────────────
    logger.info("Loading model from %s...", MODEL_DIR)
    from src.model import PhishingClassifier
    classifier = PhishingClassifier(model_dir=MODEL_DIR)

    if not classifier.is_model_available():
        logger.error("Model not found. Run 'python scripts/train.py' first.")
        sys.exit(1)

    # ── Run inference on test set ──────────────────────────────────────────────
    logger.info("Running inference on %d test samples...", len(test_records))
    y_true = []
    y_pred = []
    y_prob = []
    errors: list[dict] = []

    for i, record in enumerate(test_records):
        if i % 100 == 0 and i > 0:
            logger.info("  %d / %d done...", i, len(test_records))

        result = classifier.score(record["text"])
        y_true.append(record["label"])
        y_pred.append(int(result.is_phishing))
        y_prob.append(result.probability)

        # Collect misclassifications for error analysis
        if int(result.is_phishing) != record["label"]:
            errors.append({
                "true_label": record["label"],
                "predicted_label": int(result.is_phishing),
                "probability": result.probability,
                "text_preview": record["text"][:200] + "...",
                "top_tokens": result.top_tokens,
            })

    # ── Metrics ────────────────────────────────────────────────────────────────
    from sklearn.metrics import (
        classification_report,
        confusion_matrix,
        roc_auc_score,
        precision_recall_curve,
    )
    import numpy as np

    logger.info("\n── Classification Report ──")
    report = classification_report(
        y_true, y_pred,
        target_names=["Legitimate (0)", "Phishing (1)"]
    )
    print(report)

    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    logger.info("── Confusion Matrix ──")
    logger.info("                 Predicted: Legit  |  Predicted: Phishing")
    logger.info("  Actual: Legit       %5d        |     %5d  (False Positives)", tn, fp)
    logger.info("  Actual: Phish       %5d        |     %5d  (True Positives)", fn, tp)

    auc = roc_auc_score(y_true, y_prob)
    logger.info("\n── ROC AUC: %.4f ──", auc)

    # ── Threshold analysis ────────────────────────────────────────────────────
    from sklearn.metrics import f1_score as sk_f1
    logger.info("\n── Threshold Analysis ──")
    logger.info("  Threshold | Precision | Recall | F1")
    for threshold in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
        preds_at_t = [1 if p >= threshold else 0 for p in y_prob]
        from sklearn.metrics import precision_score, recall_score
        prec = precision_score(y_true, preds_at_t, zero_division=0)
        rec  = recall_score(y_true, preds_at_t, zero_division=0)
        f1   = sk_f1(y_true, preds_at_t, zero_division=0)
        logger.info("    %.2f     |   %.4f    | %.4f | %.4f", threshold, prec, rec, f1)

    # ── Error analysis ────────────────────────────────────────────────────────
    false_positives = [e for e in errors if e["true_label"] == 0]
    false_negatives = [e for e in errors if e["true_label"] == 1]

    logger.info(
        "\n── Error Analysis ── (total misclassified: %d)", len(errors)
    )
    logger.info("  False Positives (legit → phishing): %d", len(false_positives))
    logger.info("  False Negatives (phishing → legit): %d", len(false_negatives))

    if false_negatives[:3]:
        logger.info("\n  Sample missed phishing emails (false negatives):")
        for e in false_negatives[:3]:
            logger.info("    score=%.3f | tokens=%s", e["probability"], e["top_tokens"])
            logger.info("    text: %s", e["text_preview"])

    # ── Final verdict ─────────────────────────────────────────────────────────
    from sklearn.metrics import f1_score as sk_f1
    final_f1 = sk_f1(y_true, y_pred)
    logger.info("\n%s", "=" * 60)
    logger.info("Final F1 Score  : %.4f  (target: ≥ 0.92)", final_f1)
    logger.info("ROC AUC         : %.4f", auc)
    if final_f1 >= 0.92:
        logger.info("✅ Model meets the F1 ≥ 0.92 target!")
    else:
        logger.warning(
            "⚠️  F1 %.4f below target 0.92. Consider: more epochs, larger dataset, "
            "or lower decision threshold.", final_f1
        )
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
