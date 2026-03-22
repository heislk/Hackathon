from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from datasets import Dataset, DatasetDict
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from .redactor import PIIRedactor


@dataclass(frozen=True)
class TrainingRow:
    text: str
    label: int
    source: str = ""


def _coerce_label(value) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    label = str(value).strip().lower()
    if label in {"1", "true", "spam", "smish", "smishing", "phish", "phishing", "fraud", "scam"}:
        return 1
    if label in {"0", "false", "ham", "legit", "legitimate", "clean", "normal", "benign"}:
        return 0
    raise ValueError(f"Unsupported label value: {value!r}")


def load_rows_from_csv(path: str | Path, text_column: str = "text", label_column: str = "label") -> list[TrainingRow]:
    rows: list[TrainingRow] = []
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for item in reader:
            text = str(item.get(text_column, "")).strip()
            label_value = item.get(label_column, 0)
            if not text:
                continue
            rows.append(TrainingRow(text=text, label=_coerce_label(label_value), source=str(path)))
    return rows


def load_rows_from_jsonl(path: str | Path, text_key: str = "text", label_key: str = "label") -> list[TrainingRow]:
    rows: list[TrainingRow] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            item = json.loads(line)
            text = str(item.get(text_key, "")).strip()
            if not text:
                continue
            rows.append(TrainingRow(text=text, label=_coerce_label(item.get(label_key, 0)), source=str(path)))
    return rows


def combine_rows(*groups: Sequence[TrainingRow]) -> list[TrainingRow]:
    combined: list[TrainingRow] = []
    for group in groups:
        combined.extend(group)
    return combined


def redact_rows(rows: Iterable[TrainingRow], default_region: str = "US") -> list[TrainingRow]:
    redactor = PIIRedactor()
    redacted: list[TrainingRow] = []
    for row in rows:
        redacted.append(
            TrainingRow(
                text=redactor.redact(row.text, default_region=default_region),
                label=row.label,
                source=row.source,
            )
        )
    return redacted


def build_dataset(rows: Sequence[TrainingRow], test_size: float = 0.1, val_size: float = 0.1, seed: int = 42) -> DatasetDict:
    if not rows:
        raise ValueError("No training rows were provided.")

    texts = [row.text for row in rows]
    labels = [row.label for row in rows]
    train_texts, temp_texts, train_labels, temp_labels = train_test_split(
        texts,
        labels,
        test_size=test_size + val_size,
        random_state=seed,
        stratify=labels,
    )

    relative_val_size = val_size / (test_size + val_size)
    val_texts, test_texts, val_labels, test_labels = train_test_split(
        temp_texts,
        temp_labels,
        test_size=1 - relative_val_size,
        random_state=seed,
        stratify=temp_labels,
    )

    return DatasetDict(
        {
            "train": Dataset.from_dict({"text": train_texts, "label": train_labels}),
            "validation": Dataset.from_dict({"text": val_texts, "label": val_labels}),
            "test": Dataset.from_dict({"text": test_texts, "label": test_labels}),
        }
    )


def train_classifier(
    rows: Sequence[TrainingRow],
    output_dir: str | Path,
    base_model: str = "distilbert-base-uncased",
    epochs: int = 3,
    batch_size: int = 16,
    learning_rate: float = 2e-5,
    max_length: int = 128,
    seed: int = 42,
) -> Trainer:
    dataset = build_dataset(rows, seed=seed)
    tokenizer = AutoTokenizer.from_pretrained(base_model)

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=max_length)

    tokenized = dataset.map(tokenize, batched=True)
    tokenized = tokenized.remove_columns(["text"])
    tokenized.set_format("torch")

    model = AutoModelForSequenceClassification.from_pretrained(base_model, num_labels=2)

    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        predicted_labels = predictions.argmax(axis=-1)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels,
            predicted_labels,
            average="binary",
            zero_division=0,
        )
        accuracy = accuracy_score(labels, predicted_labels)
        return {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }

    args = TrainingArguments(
        output_dir=str(output_dir),
        evaluation_strategy="epoch",
        save_strategy="epoch",
        learning_rate=learning_rate,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        num_train_epochs=epochs,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="eval_f1",
        greater_is_better=True,
        logging_steps=25,
        report_to=[],
        seed=seed,
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )
    trainer.train()
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    return trainer
