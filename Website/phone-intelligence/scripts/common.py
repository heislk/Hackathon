#!/usr/bin/env python3
"""
Shared helpers for the phone-intelligence pipeline.

This module keeps the downloader, trainer, and evaluator aligned on:
  - real-data record normalization
  - privacy-safe text sanitization
  - simple sender/message signal feature tokens
  - stratified splits and JSONL persistence
  - a single scikit-learn pipeline that works without torch/transformers

The pipeline is intentionally text-first:
  - raw message content is sanitized before it reaches the model
  - URLs, emails, and phone numbers are defanged into placeholders
  - optional sender-number metadata is converted into non-PII feature tokens

The default training sources are real SMS/smishing corpora only:
  - UCI SMS Spam Collection
  - MOZNLP/MOZ-Smishing (filtered to SMS rows)
  - optional manual CSV imports with real message data
  - optional Sting9 API access when an auth token is supplied
"""

from __future__ import annotations

import csv
import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = REPO_ROOT / "data" / "phone-intelligence"

URL_RE = re.compile(r"(?i)\b(?:https?://|www\.)\S+")
EMAIL_RE = re.compile(r"(?i)\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(
    r"(?<!\w)(?:\+?\d[\d\s().-]{5,}\d)(?!\w)"
)
SHORTENER_RE = re.compile(
    r"(?i)\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|cutt\.ly|rebrand\.ly|rb\.gy|is\.gd|lnkd\.in)\b"
)
NON_PRINTABLE_RE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
WHITESPACE_RE = re.compile(r"\s+")

URGENCY_TERMS = {
    "urgent",
    "immediately",
    "now",
    "final notice",
    "act now",
    "limited time",
    "suspended",
    "locked",
    "verify",
    "verification",
    "expire",
    "expired",
    "resend",
    "confirm",
    "confirmation",
}

MONEY_TERMS = {
    "cash",
    "payment",
    "pay",
    "transfer",
    "refund",
    "balance",
    "bank",
    "account",
    "invoice",
    "invoice",
    "loan",
    "wire",
    "charge",
    "charged",
    "money",
    "prize",
    "gift card",
}

OTP_TERMS = {
    "otp",
    "code",
    "verification code",
    "security code",
    "passcode",
    "one-time",
    "one time",
}

DELIVERY_TERMS = {
    "delivery",
    "parcel",
    "package",
    "shipment",
    "shipping",
    "courier",
    "tracking",
    "track",
}

LOGIN_TERMS = {
    "login",
    "sign in",
    "password",
    "account",
    "session",
    "access",
}

BRAND_TERMS = {
    "paypal",
    "venmo",
    "cash app",
    "zelle",
    "bank",
    "apple",
    "google",
    "amazon",
    "microsoft",
    "netflix",
    "instagram",
    "facebook",
    "whatsapp",
    "telegram",
    "uber",
    "lyft",
}


@dataclass(frozen=True)
class PipelineConfig:
    word_ngram_min: int = 1
    word_ngram_max: int = 2
    char_ngram_min: int = 3
    char_ngram_max: int = 5
    word_min_df: int = 2
    char_min_df: int = 2
    word_max_features: int = 35000
    char_max_features: int = 45000
    classifier_c: float = 4.0
    max_iter: int = 4000
    random_seed: int = 42


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_data_dir(env_name: str = "PHONE_INTELLIGENCE_DATA_DIR") -> Path:
    value = os.getenv(env_name)
    if value:
        return Path(value).expanduser().resolve()
    return DEFAULT_DATA_DIR


def data_paths() -> dict[str, Path]:
    data_dir = resolve_data_dir()
    return {
        "data_dir": data_dir,
        "raw_dir": Path(os.getenv("PHONE_INTELLIGENCE_RAW_DIR", str(data_dir / "raw"))).expanduser().resolve(),
        "processed_dir": Path(os.getenv("PHONE_INTELLIGENCE_PROCESSED_DIR", str(data_dir / "processed"))).expanduser().resolve(),
        "splits_dir": Path(os.getenv("PHONE_INTELLIGENCE_SPLITS_DIR", str(data_dir / "splits"))).expanduser().resolve(),
        "model_dir": Path(os.getenv("PHONE_INTELLIGENCE_MODEL_DIR", str(data_dir / "model"))).expanduser().resolve(),
    }


def normalize_whitespace(text: str) -> str:
    text = "" if text is None else str(text)
    text = NON_PRINTABLE_RE.sub(" ", unicodedata.normalize("NFKC", text))
    return WHITESPACE_RE.sub(" ", text).strip()


def sanitize_message_text(text: str) -> str:
    text = normalize_whitespace(str(text))
    text = URL_RE.sub(" URLTOKEN ", text)
    text = EMAIL_RE.sub(" EMAILTOKEN ", text)
    text = PHONE_RE.sub(" PHONETOKEN ", text)
    return WHITESPACE_RE.sub(" ", text).strip().lower()


def sanitize_token(value: Any) -> str:
    token = normalize_whitespace(str(value)).lower()
    token = re.sub(r"[^a-z0-9]+", "_", token)
    return token.strip("_") or "unknown"


def bucket_number(value: int) -> str:
    if value <= 0:
        return "0"
    if value == 1:
        return "1"
    if value == 2:
        return "2"
    if value <= 4:
        return "3_4"
    if value <= 9:
        return "5_9"
    if value <= 19:
        return "10_19"
    return "20_plus"


def count_terms(text: str, terms: Sequence[str]) -> int:
    lowered = text.lower()
    return sum(1 for term in terms if term in lowered)


def extract_signal_tokens(text: str) -> list[str]:
    raw = normalize_whitespace(str(text))
    lowered = raw.lower()
    tokens: list[str] = []

    url_count = len(URL_RE.findall(raw))
    email_count = len(EMAIL_RE.findall(raw))
    phone_count = len(PHONE_RE.findall(raw))
    digit_count = sum(ch.isdigit() for ch in raw)
    alpha_count = sum(ch.isalpha() for ch in raw)
    uppercase_count = sum(ch.isupper() for ch in raw)

    if url_count:
        tokens.append("has_url")
    if email_count:
        tokens.append("has_email")
    if phone_count:
        tokens.append("has_phone")
    if SHORTENER_RE.search(raw):
        tokens.append("has_shortener")
    if count_terms(lowered, URGENCY_TERMS):
        tokens.append("has_urgency")
    if count_terms(lowered, MONEY_TERMS):
        tokens.append("has_money")
    if count_terms(lowered, OTP_TERMS):
        tokens.append("has_otp")
    if count_terms(lowered, DELIVERY_TERMS):
        tokens.append("has_delivery")
    if count_terms(lowered, LOGIN_TERMS):
        tokens.append("has_login")
    if count_terms(lowered, BRAND_TERMS):
        tokens.append("has_brand")

    tokens.extend(
        [
            f"url_count_{bucket_number(url_count)}",
            f"email_count_{bucket_number(email_count)}",
            f"phone_count_{bucket_number(phone_count)}",
            f"digit_count_{bucket_number(digit_count)}",
            f"length_{bucket_number(len(raw))}",
            f"alpha_{bucket_number(alpha_count)}",
            f"uppercase_{bucket_number(uppercase_count)}",
        ]
    )

    return tokens


def sender_signal_tokens(sender: Any) -> list[str]:
    if sender is None:
        return []

    raw = normalize_whitespace(str(sender))
    if not raw:
        return []

    lowered = raw.lower()
    digits = re.sub(r"\D", "", raw)
    has_letters = any(ch.isalpha() for ch in raw)
    has_digits = any(ch.isdigit() for ch in raw)

    tokens = ["sender_present"]
    if raw.startswith("+"):
        tokens.append("sender_has_plus")
    if has_letters and has_digits:
        tokens.append("sender_alphanumeric")
    elif has_letters:
        tokens.append("sender_alpha")
    elif has_digits:
        tokens.append("sender_numeric")

    if len(digits) <= 6 and digits:
        tokens.append("sender_shortcode")
    elif len(digits) >= 7:
        tokens.append("sender_longcode")

    tokens.extend(
        [
            f"sender_digit_count_{bucket_number(len(digits))}",
            f"sender_text_len_{bucket_number(len(lowered))}",
        ]
    )
    return tokens


def compose_model_text(record: Mapping[str, Any] | str) -> str:
    if isinstance(record, str):
        text = record
        sender = None
    else:
        text = record.get("text") or record.get("message") or record.get("body_text") or ""
        sender = record.get("sender") or record.get("sender_number") or record.get("from")

    clean_text = sanitize_message_text(text)
    signal_tokens = extract_signal_tokens(text)
    sender_tokens = sender_signal_tokens(sender)
    parts = [clean_text] + signal_tokens + sender_tokens
    return " ".join(part for part in parts if part).strip()


class SMSComposer(BaseEstimator, TransformerMixin):
    """Transform raw record dictionaries into privacy-safe model strings."""

    def fit(self, X, y=None):  # noqa: D401
        return self

    def transform(self, X):  # noqa: D401
        return [compose_model_text(item) for item in X]


def build_pipeline(config: PipelineConfig | None = None) -> Pipeline:
    config = config or PipelineConfig()

    word_pipe = Pipeline(
        [
            ("compose", SMSComposer()),
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    analyzer="word",
                    ngram_range=(config.word_ngram_min, config.word_ngram_max),
                    min_df=config.word_min_df,
                    max_features=config.word_max_features,
                    sublinear_tf=True,
                    token_pattern=r"(?u)\b\w+\b",
                ),
            ),
        ]
    )

    char_pipe = Pipeline(
        [
            ("compose", SMSComposer()),
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    analyzer="char_wb",
                    ngram_range=(config.char_ngram_min, config.char_ngram_max),
                    min_df=config.char_min_df,
                    max_features=config.char_max_features,
                    sublinear_tf=True,
                ),
            ),
        ]
    )

    features = FeatureUnion([("word", word_pipe), ("char", char_pipe)])
    classifier = LogisticRegression(
        C=config.classifier_c,
        class_weight="balanced",
        max_iter=config.max_iter,
        solver="liblinear",
    )

    return Pipeline([("features", features), ("classifier", classifier)])


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def save_jsonl(records: Iterable[Mapping[str, Any]], path: Path) -> int:
    ensure_dir(path.parent)
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(dict(record), ensure_ascii=False) + "\n")
            count += 1
    return count


def canonical_label(label: Any) -> int | None:
    if label is None:
        return None
    token = sanitize_token(label)
    positive = {
        "spam",
        "phishing",
        "smishing",
        "malicious",
        "fraud",
        "scam",
        "junk",
        "abuse",
        "1",
        "true",
        "yes",
    }
    negative = {
        "ham",
        "legitimate",
        "legit",
        "benign",
        "normal",
        "0",
        "false",
        "no",
    }
    if token in positive:
        return 1
    if token in negative:
        return 0
    if "smish" in token or "phish" in token or "spam" in token or "scam" in token:
        return 1
    if "legit" in token or "ham" in token:
        return 0
    return None


def dedupe_records(records: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, int]] = set()
    unique: list[dict[str, Any]] = []
    dropped = 0

    for record in records:
        label = record.get("label")
        if label not in (0, 1):
            continue
        key = (sanitize_message_text(record.get("text", "")), int(label))
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        unique.append(dict(record))

    if dropped:
        logger.info("Deduplicated %d repeated records", dropped)
    return unique


def stratified_split(
    records: Sequence[Mapping[str, Any]],
    train_ratio: float = 0.80,
    val_ratio: float = 0.10,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio must be between 0 and 1")
    if not 0 <= val_ratio < 1:
        raise ValueError("val_ratio must be between 0 and 1")
    if train_ratio + val_ratio >= 1:
        raise ValueError("train_ratio + val_ratio must be < 1")

    buckets: dict[int, list[dict[str, Any]]] = {0: [], 1: []}
    for record in records:
        label = record.get("label")
        if label in (0, 1):
            buckets[int(label)].append(dict(record))

    import random

    rng = random.Random(seed)
    train: list[dict[str, Any]] = []
    val: list[dict[str, Any]] = []
    test: list[dict[str, Any]] = []

    for label_records in buckets.values():
        rng.shuffle(label_records)
        n = len(label_records)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        train.extend(label_records[:n_train])
        val.extend(label_records[n_train:n_train + n_val])
        test.extend(label_records[n_train + n_val:])

    rng.shuffle(train)
    rng.shuffle(val)
    rng.shuffle(test)
    return train, val, test


def counts_by_label(records: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    counts = {"0": 0, "1": 0}
    for record in records:
        label = record.get("label")
        if label in (0, 1):
            counts[str(int(label))] += 1
    return counts


def counts_by_source(records: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for record in records:
        source = str(record.get("source") or "unknown")
        counts[source] = counts.get(source, 0) + 1
    return counts


def infer_csv_columns(fieldnames: Sequence[str]) -> tuple[str, str, str | None]:
    normalized = {sanitize_token(name): name for name in fieldnames}
    text_candidates = [
        "text",
        "message",
        "sms",
        "body_text",
        "body",
        "content",
        "message_text",
    ]
    label_candidates = [
        "label",
        "category",
        "class",
        "target",
        "spam_ham",
        "type",
        "status",
    ]
    sender_candidates = [
        "sender",
        "from",
        "origin",
        "phone",
        "phone_number",
        "sender_number",
    ]

    text_col = next((normalized[c] for c in text_candidates if c in normalized), None)
    label_col = next((normalized[c] for c in label_candidates if c in normalized), None)
    sender_col = next((normalized[c] for c in sender_candidates if c in normalized), None)

    if not text_col or not label_col:
        raise ValueError(
            f"Could not infer text/label columns from: {list(fieldnames)}"
        )
    return text_col, label_col, sender_col


def parse_csv_records(path: Path, source: str = "manual_csv") -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return records
        text_col, label_col, sender_col = infer_csv_columns(reader.fieldnames)
        for idx, row in enumerate(reader):
            text = row.get(text_col, "")
            label = canonical_label(row.get(label_col))
            if not text or label is None:
                continue
            record = {
                "id": f"{path.stem}_{idx}",
                "source": source,
                "text": normalize_whitespace(text),
                "label": label,
                "sender": normalize_whitespace(row.get(sender_col, "")) if sender_col else "",
            }
            records.append(record)
    return records


def parse_uci_line(line: str) -> dict[str, Any] | None:
    raw = "" if line is None else str(line).rstrip("\r\n")
    if not raw or "\t" not in raw:
        return None
    label_text, message = raw.split("\t", 1)
    label = canonical_label(label_text)
    if label is None:
        return None
    return {
        "source": "uci_sms_spam_collection",
        "text": normalize_whitespace(message),
        "label": label,
        "sender": "",
    }


def parse_moz_row(row: Mapping[str, Any]) -> dict[str, Any] | None:
    if str(row.get("source", "")).strip().lower() != "sms":
        return None

    label = canonical_label(row.get("label"))
    text = row.get("text", "")
    if label is None or not text:
        return None

    return {
        "id": str(row.get("id", "")),
        "source": "moz_smishing_sms",
        "text": normalize_whitespace(text),
        "label": label,
        "sender": "",
        "attack_type": "smishing" if label == 1 else "legitimate",
    }


def parse_sting9_row(row: Mapping[str, Any]) -> dict[str, Any] | None:
    text = (
        row.get("body_text")
        or row.get("message")
        or row.get("text")
        or row.get("subject_text")
        or row.get("content")
        or ""
    )
    if not text:
        return None

    sender = (
        row.get("claimed_sender_name")
        or row.get("sender")
        or row.get("sender_domain")
        or row.get("from")
        or ""
    )
    return {
        "id": str(row.get("submission_id") or row.get("id") or ""),
        "source": "sting9",
        "text": normalize_whitespace(text),
        "label": 1,
        "sender": normalize_whitespace(sender),
        "attack_type": sanitize_token(row.get("attack_type") or "smishing"),
        "message_type": sanitize_token(row.get("message_type") or "sms"),
    }


def merge_records(*groups: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for group in groups:
        for record in group:
            if record.get("label") in (0, 1) and record.get("text"):
                merged.append(dict(record))
    return merged
