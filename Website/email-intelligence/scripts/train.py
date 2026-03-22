#!/usr/bin/env python3
"""
email-intelligence/scripts/train.py

Fine-tunes distilbert-base-uncased for binary phishing classification.

WHAT FINE-TUNING DOES:
  Takes a pre-trained DistilBERT model (trained on 8M Wikipedia + BookCorpus documents
  to understand English language structure) and adapts it to classify emails
  as phishing (1) or legitimate (0) by:
    1. Adding a classification head (768 → 2 linear layer) to the [CLS] token output
    2. Training all weights with a very small learning rate (2e-5) on labeled email data
    3. Evaluating on a held-out validation set after each epoch
    4. Saving the checkpoint with the best validation F1 score

TRAINING DATA:
  Expects data/processed/phishing.jsonl and data/processed/ham.jsonl
  Run scripts/download_dataset.py first if these don't exist.

SPLIT:
  80% train / 10% validation / 10% test (stratified by label)
  Test split is held out — not used during training — for final evaluation only.

HYPERPARAMETERS:
  Learning rate:  2e-5   (standard for DistilBERT fine-tuning)
  Batch size:     16     (reduce to 8 if OOM on CPU)
  Epochs:         3      (usually sufficient for binary classification fine-tuning)
  Max tokens:     512    (DistilBERT's context window)
  Optimizer:      AdamW with weight decay 0.01
  Warmup steps:   100

OUTPUT:
  model/           — saved model weights (pytorch_model.bin, config.json, tokenizer_config.json)
  data/splits/     — train/val/test JSONL splits (for reproducibility)

USAGE:
  cd email-intelligence
  python scripts/train.py                     # CPU training
  python scripts/train.py --batch-size 8      # reduce if OOM
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
from pathlib import Path

import torch
from datasets import Dataset
from transformers import (
    DataCollatorWithPadding,
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments,
)
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

REPO_ROOT   = Path(__file__).parent.parent
PROC_DIR    = REPO_ROOT / os.getenv("PROCESSED_DATA_DIR", "data/processed")
SPLITS_DIR  = REPO_ROOT / "data/splits"
MODEL_DIR   = REPO_ROOT / os.getenv("MODEL_DIR", "model")
SRC_DIR     = REPO_ROOT / "src"
LOCAL_FILES_ONLY = os.getenv("HF_LOCAL_FILES_ONLY", "true").lower() != "false"

sys.path.insert(0, str(REPO_ROOT))
from src.model import BASE_MODEL_NAME


def load_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def stratified_split(
    records: list[dict],
    train_ratio: float = 0.80,
    val_ratio: float = 0.10,
    seed: int = 42,
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Stratified train/val/test split preserving class balance.
    Remaining (1 - train_ratio - val_ratio) goes to test set.
    """
    by_label: dict[int, list[dict]] = {}
    for rec in records:
        by_label.setdefault(rec["label"], []).append(rec)

    train, val, test = [], [], []
    rng = random.Random(seed)

    for label_records in by_label.values():
        rng.shuffle(label_records)
        n = len(label_records)
        n_train = int(n * train_ratio)
        n_val   = int(n * val_ratio)
        train += label_records[:n_train]
        val   += label_records[n_train:n_train + n_val]
        test  += label_records[n_train + n_val:]

    rng.shuffle(train)
    return train, val, test


def save_split(records: list[dict], path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    logger.info("Saved %d records → %s", len(records), path)


def detect_training_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def trim_record_text(records: list[dict], max_chars: int) -> list[dict]:
    if max_chars <= 0:
        return records

    trimmed: list[dict] = []
    changed = 0
    for record in records:
        text = record["text"]
        if len(text) > max_chars:
            updated = dict(record)
            updated["text"] = text[:max_chars]
            trimmed.append(updated)
            changed += 1
        else:
            trimmed.append(record)

    if changed:
        logger.info("Trimmed %d long emails to %d chars before tokenization.", changed, max_chars)
    return trimmed


def main(args):
    device = detect_training_device()
    logger.info("=" * 60)
    logger.info("DistilBERT Phishing Classifier — Fine-tuning")
    logger.info("=" * 60)
    logger.info("Base model  : %s", BASE_MODEL_NAME)
    logger.info("Epochs      : %d", args.epochs)
    logger.info("Batch size  : %d", args.batch_size)
    logger.info("Learn rate  : %s", args.lr)
    logger.info("Max tokens  : %d", args.max_length)
    logger.info("Max chars   : %d", args.max_chars)
    logger.info("Offline HF  : %s", "yes" if LOCAL_FILES_ONLY else "no")
    if device == "mps":
        logger.info("Accelerator : MPS (Apple Silicon GPU)")
    elif device == "cuda":
        logger.info("Accelerator : CUDA (NVIDIA GPU)")
    else:
        logger.info("Accelerator : CPU (Slow)")

    # ── Check datasets exist ───────────────────────────────────────────────────
    phishing_file = PROC_DIR / "phishing.jsonl"
    ham_file      = PROC_DIR / "ham.jsonl"

    if not phishing_file.exists() or not ham_file.exists():
        logger.error(
            "Training data not found at %s. "
            "Run 'python scripts/download_dataset.py' first.",
            PROC_DIR
        )
        sys.exit(1)

    # ── Load data ─────────────────────────────────────────────────────────────
    logger.info("\n[1/5] Loading datasets...")
    phishing = load_jsonl(phishing_file)
    ham = load_jsonl(ham_file)

    logger.info("  Phishing samples : %d", len(phishing))
    logger.info("  Ham samples      : %d", len(ham))

    all_records = phishing + ham

    # ── Split ─────────────────────────────────────────────────────────────────
    logger.info("\n[2/5] Creating stratified train/val/test splits (80/10/10)...")
    train_data, val_data, test_data = stratified_split(all_records)
    train_data = trim_record_text(train_data, args.max_chars)
    val_data = trim_record_text(val_data, args.max_chars)
    test_data = trim_record_text(test_data, args.max_chars)

    if args.train_limit:
        train_data = train_data[:args.train_limit]
        logger.info("  Train limit applied: %d", len(train_data))
    if args.val_limit:
        val_data = val_data[:args.val_limit]
        logger.info("  Val limit applied  : %d", len(val_data))

    logger.info("  Train: %d | Val: %d | Test: %d", len(train_data), len(val_data), len(test_data))

    # Save splits for reproducibility
    save_split(train_data, SPLITS_DIR / "train.jsonl")
    save_split(val_data,   SPLITS_DIR / "val.jsonl")
    save_split(test_data,  SPLITS_DIR / "test.jsonl")

    # ── Tokenize ──────────────────────────────────────────────────────────────
    logger.info("\n[3/5] Loading DistilBERT tokenizer and tokenizing splits...")

    tokenizer = DistilBertTokenizerFast.from_pretrained(
        BASE_MODEL_NAME,
        local_files_only=LOCAL_FILES_ONLY,
    )

    def tokenize(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
        )

    def to_hf_dataset(records: list[dict]) -> Dataset:
        texts  = [r["text"]  for r in records]
        labels = [r["label"] for r in records]
        ds = Dataset.from_dict({"text": texts, "label": labels})
        return ds.map(tokenize, batched=True, remove_columns=["text"])

    train_ds = to_hf_dataset(train_data)
    val_ds   = to_hf_dataset(val_data)
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer, pad_to_multiple_of=8)

    logger.info("Tokenization complete.")

    # ── Model ─────────────────────────────────────────────────────────────────
    logger.info("\n[4/5] Loading DistilBERT and setting up training...")

    model = DistilBertForSequenceClassification.from_pretrained(
        BASE_MODEL_NAME,
        num_labels=2,
        id2label={0: "LEGITIMATE", 1: "PHISHING"},
        label2id={"LEGITIMATE": 0, "PHISHING": 1},
        local_files_only=LOCAL_FILES_ONLY,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(MODEL_DIR),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_ratio=0.05,
        eval_strategy="epoch",        # For transformers v4.41.0+
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        logging_steps=50,
        save_total_limit=1,
        group_by_length=True,
        report_to="none",                  # no wandb / tensorboard unless configured
        fp16=device == "cuda",             # use fp16 if GPU available
        use_mps_device=device == "mps",    # use Apple Silicon GPU if available
        dataloader_pin_memory=device == "cuda",
        dataloader_num_workers=0 if sys.platform == "darwin" else min(2, os.cpu_count() or 1),
        seed=42,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = logits.argmax(axis=-1)
        return {
            "accuracy":  accuracy_score(labels, preds),
            "f1":        f1_score(labels, preds, average="binary"),
            "precision": precision_score(labels, preds, average="binary"),
            "recall":    recall_score(labels, preds, average="binary"),
        }

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    # ── Train ─────────────────────────────────────────────────────────────────
    logger.info("\n[5/5] Starting fine-tuning... (this may take 30–60 min on CPU)")
    trainer.train()

    # ── Save best model ────────────────────────────────────────────────────────
    logger.info("Saving best model to %s...", MODEL_DIR)
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))
    logger.info("Model and tokenizer saved.")

    # ── Final val metrics ─────────────────────────────────────────────────────
    logger.info("\n── Final validation metrics ──")
    metrics = trainer.evaluate()
    for k, v in metrics.items():
        logger.info("  %-25s %.4f", k, v)

    logger.info("\n%s", "=" * 60)
    logger.info("Training complete!")
    logger.info("  Model saved to : %s", MODEL_DIR)
    logger.info("  Val F1         : %.4f", metrics.get("eval_f1", 0))
    logger.info("\nNext step: python scripts/evaluate.py")
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune DistilBERT for phishing detection")
    parser.add_argument("--epochs",     type=int,   default=int(os.getenv("TRAINING_EPOCHS",     "1")))
    parser.add_argument("--batch-size", type=int,   default=int(os.getenv("TRAINING_BATCH_SIZE", "64")))
    parser.add_argument("--lr",         type=float, default=float(os.getenv("LEARNING_RATE",     "2e-5")))
    parser.add_argument("--max-length", type=int,   default=int(os.getenv("MAX_TOKEN_LENGTH",    "128")))
    parser.add_argument("--max-chars",  type=int,   default=int(os.getenv("MAX_CHAR_LENGTH",     "4096")))
    parser.add_argument("--train-limit", type=int,  default=int(os.getenv("TRAIN_LIMIT",         "0")))
    parser.add_argument("--val-limit",   type=int,  default=int(os.getenv("VAL_LIMIT",           "0")))
    main(parser.parse_args())
