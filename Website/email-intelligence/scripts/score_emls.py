#!/usr/bin/env python3
"""
Score one or more EML files and report whether they appeared in train/val/test.

Examples:
  ./.venv/bin/python scripts/score_emls.py tests/sample_emails/phishing_sample.eml
  ./.venv/bin/python scripts/score_emls.py data/raw/phishing_pot/email/sample-6461.eml
  ./.venv/bin/python scripts/score_emls.py data/raw/phishing_pot/email data/raw/easy_ham --limit 10
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
SPLITS_DIR = REPO_ROOT / "data/splits"
MODEL_DIR = REPO_ROOT / os.getenv("MODEL_DIR", "model")
os.environ.setdefault("TLDEXTRACT_CACHE", "/tmp/email-intelligence-tldextract")
SUPPORTED_SUFFIXES = {".eml"}

_CRYPTO_SIGNAL_RE = re.compile(
    r"\b(wallet|crypto|bitcoin|btc|ethereum|eth|solana|usdt|metamask|ledger|coinbase|binance)\b",
    re.IGNORECASE,
)

sys.path.insert(0, str(REPO_ROOT))


def build_split_index() -> dict[str, dict]:
    index: dict[str, dict] = {}
    for split_name in ("train", "val", "test"):
        split_path = SPLITS_DIR / f"{split_name}.jsonl"
        if not split_path.exists():
            continue
        with split_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                digest = hashlib.sha256(record["text"].encode("utf-8")).hexdigest()
                index[digest] = {
                    "split": split_name,
                    "label": record["label"],
                    "sender_domain": record.get("sender_domain"),
                }
    return index


def collect_files(paths: list[str], limit: int) -> list[Path]:
    collected: list[Path] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            logger.warning("Skipping missing path: %s", path)
            continue
        if path.is_file():
            if path.suffix.lower() not in SUPPORTED_SUFFIXES:
                logger.warning("Skipping non-EML file: %s", path)
                continue
            collected.append(path)
            continue
        for child in sorted(
            p
            for p in path.rglob("*")
            if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES
        ):
            collected.append(child)
            if limit and len(collected) >= limit:
                return collected
    return collected[:limit] if limit else collected


def main(args: argparse.Namespace) -> None:
    from src.model import PhishingClassifier
    from src.parser import EMLParser
    from src.redactor import PIIRedactor

    parser = EMLParser()
    redactor = PIIRedactor()
    classifier = PhishingClassifier(model_dir=MODEL_DIR)
    split_index = build_split_index()

    files = collect_files(args.paths, args.limit)
    if not files:
        raise SystemExit("No files found to score.")

    print(
        "file\tprobability\trisk_tier\tpredicted\tcrypto_signals\tseen_in_split\ttrue_label"
    )

    for file_path in files:
        try:
            parsed = parser.parse_file(file_path)
            redacted_text = (
                f"Subject: {redactor.redact_subject(parsed.subject)}\n\n"
                f"{redactor.redact(parsed.body_text)}"
            ).strip()
            digest = hashlib.sha256(redacted_text.encode("utf-8")).hexdigest()
            membership = split_index.get(digest)
            result = classifier.score(redacted_text)

            crypto_signals = bool(parsed.crypto_addresses) or any(
                _CRYPTO_SIGNAL_RE.search(candidate)
                for candidate in (
                    parsed.subject,
                    parsed.body_text,
                    redacted_text,
                )
            )

            predicted = "phishing" if result.is_phishing else "legitimate"
            true_label = "-"
            seen_in_split = "external"
            if membership:
                true_label = "phishing" if membership["label"] == 1 else "legitimate"
                seen_in_split = membership["split"]

            print(
                f"{file_path}\t{result.probability:.4f}\t{result.risk_tier}\t"
                f"{predicted}\t{str(crypto_signals).lower()}\t{seen_in_split}\t{true_label}"
            )
        except Exception as exc:
            print(f"{file_path}\tERROR\t-\t-\t-\t-\t{exc}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score EML files and report dataset membership.")
    parser.add_argument("paths", nargs="+", help="Files or directories to score")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of files to score")
    main(parser.parse_args())
