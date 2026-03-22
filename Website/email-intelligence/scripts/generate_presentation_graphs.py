#!/usr/bin/env python3
"""
Generate presentation-ready evaluation charts for the phishing classifier.

Outputs:
  artifacts/model_metrics.png
  artifacts/confusion_matrix.png
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
SPLITS_DIR = REPO_ROOT / "data/splits"
MODEL_DIR = REPO_ROOT / os.getenv("MODEL_DIR", "model")
ARTIFACTS_DIR = REPO_ROOT / "artifacts"

sys.path.insert(0, str(REPO_ROOT))


def load_test_records() -> list[dict]:
    test_file = SPLITS_DIR / "test.jsonl"
    if not test_file.exists():
        raise FileNotFoundError(f"Missing test split: {test_file}")
    with test_file.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def compute_metrics(test_records: list[dict]) -> tuple[dict[str, float], list[int], list[int]]:
    from src.model import PhishingClassifier

    classifier = PhishingClassifier(model_dir=MODEL_DIR)
    if not classifier.is_model_available():
        raise RuntimeError(f"Model not found in {MODEL_DIR}")

    y_true: list[int] = []
    y_pred: list[int] = []
    y_prob: list[float] = []

    for idx, record in enumerate(test_records, start=1):
        result = classifier.score(record["text"])
        y_true.append(record["label"])
        y_pred.append(int(result.is_phishing))
        y_prob.append(result.probability)

        if idx % 100 == 0:
            logger.info("Scored %d / %d test samples", idx, len(test_records))

    metrics = {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Precision": precision_score(y_true, y_pred, zero_division=0),
        "Recall": recall_score(y_true, y_pred, zero_division=0),
        "F1": f1_score(y_true, y_pred, zero_division=0),
        "ROC AUC": roc_auc_score(y_true, y_prob),
    }
    return metrics, y_true, y_pred


def save_metrics_chart(metrics: dict[str, float], output_path: Path) -> None:
    sns.set_theme(style="whitegrid")
    labels = list(metrics.keys())
    values = [metrics[label] for label in labels]
    colors = ["#1f77b4", "#2ca02c", "#ff7f0e", "#d62728", "#9467bd"]

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(labels, values, color=colors, width=0.65)

    ax.set_ylim(0.0, 1.05)
    ax.set_ylabel("Score")
    ax.set_title("Email Phishing Model Performance", fontsize=18, weight="bold")
    ax.set_xlabel("Held-out Test Metrics")

    for bar, value in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            value + 0.015,
            f"{value:.4f}",
            ha="center",
            va="bottom",
            fontsize=11,
            weight="bold",
        )

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def save_confusion_matrix(y_true: list[int], y_pred: list[int], output_path: Path) -> None:
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(7, 5.5))

    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        cbar=False,
        xticklabels=["Legitimate", "Phishing"],
        yticklabels=["Legitimate", "Phishing"],
        ax=ax,
    )

    ax.set_title("Confusion Matrix", fontsize=18, weight="bold")
    ax.set_xlabel("Predicted Label")
    ax.set_ylabel("True Label")
    fig.tight_layout()
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    test_records = load_test_records()
    metrics, y_true, y_pred = compute_metrics(test_records)

    metrics_path = ARTIFACTS_DIR / "model_metrics.png"
    confusion_path = ARTIFACTS_DIR / "confusion_matrix.png"

    save_metrics_chart(metrics, metrics_path)
    save_confusion_matrix(y_true, y_pred, confusion_path)

    logger.info("Saved metrics chart to %s", metrics_path)
    logger.info("Saved confusion matrix to %s", confusion_path)


if __name__ == "__main__":
    main()
