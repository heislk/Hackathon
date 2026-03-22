#!/usr/bin/env python3
"""
email-intelligence/scripts/download_dataset.py

Downloads and prepares training data for the DistilBERT phishing classifier.

DATASETS:
  1. Phishing Pot (rf-peixoto/phishing_pot) — real phishing emails (label=1)
     License: Check https://github.com/rf-peixoto/phishing_pot/blob/main/LICENSE
     Note: Already anonymized by the maintainer (victim addresses replaced with phishing@pot)
     We apply our own additional PII redaction pass on top.

  2. SpamAssassin Ham Corpus — legitimate emails (label=0)
     Source: https://spamassassin.apache.org/old/publiccorpus/
     License: Apache 2.0
     Files used: easy_ham_2.tar.bz2, easy_ham.tar.bz2

OUTPUT:
  data/processed/phishing.jsonl  — one JSON record per phishing email
  data/processed/ham.jsonl       — one JSON record per ham email

  Each record format:
  {
    "label": 0 or 1,
    "text": "Subject: ... \\n\\n [redacted body...]",
    "sender_domain": "example.ru",
    "urgency_signal_count": 3,
    "spf_fail": true,
    "dkim_fail": false
  }

USAGE:
  cd email-intelligence
  python scripts/download_dataset.py
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ─── Directories ──────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent.parent
RAW_DIR    = REPO_ROOT / os.getenv("RAW_DATA_DIR", "data/raw")
PROC_DIR   = REPO_ROOT / os.getenv("PROCESSED_DATA_DIR", "data/processed")
SRC_DIR    = REPO_ROOT / "src"

# ─── SpamAssassin ham archives ─────────────────────────────────────────────────
HAM_ARCHIVES = [
    ("easy_ham.tar.bz2",   "https://spamassassin.apache.org/old/publiccorpus/20030228_easy_ham.tar.bz2"),
    ("easy_ham_2.tar.bz2", "https://spamassassin.apache.org/old/publiccorpus/20030228_easy_ham_2.tar.bz2"),
]


def setup_dirs():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROC_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Created directories: %s, %s", RAW_DIR, PROC_DIR)


def clone_phishing_pot():
    """Clone the Phishing Pot repository if not already present."""
    dest = RAW_DIR / "phishing_pot"
    if dest.exists():
        logger.info("Phishing Pot already cloned at %s. Pulling latest...", dest)
        subprocess.run(["git", "-C", str(dest), "pull", "--quiet"], check=True)
        return dest

    logger.info("Cloning rf-peixoto/phishing_pot...")
    subprocess.run([
        "git", "clone", "--depth=1", "--quiet",
        "https://github.com/rf-peixoto/phishing_pot.git",
        str(dest)
    ], check=True)
    logger.info("Phishing Pot cloned to %s", dest)
    return dest


def download_ham_archives():
    """Download SpamAssassin ham email archives."""
    archives: list[Path] = []
    for filename, url in HAM_ARCHIVES:
        dest = RAW_DIR / filename
        if dest.exists():
            logger.info("Ham archive already exists: %s", filename)
        else:
            logger.info("Downloading ham corpus: %s", filename)
            urllib.request.urlretrieve(url, str(dest), reporthook=_progress)
        archives.append(dest)
    return archives


def _progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100, downloaded * 100 // total_size)
        print(f"\r  Progress: {percent}%", end="", flush=True)


def extract_ham(archives: list[Path]) -> list[Path]:
    """Extract ham archives and return list of individual email file paths."""
    email_files: list[Path] = []
    for archive in archives:
        extract_dir = RAW_DIR / archive.stem.replace(".tar", "")
        if extract_dir.exists():
            logger.info("Ham archive already extracted: %s", extract_dir)
        else:
            logger.info("Extracting %s...", archive.name)
            with tarfile.open(str(archive), "r:bz2") as tf:
                tf.extractall(str(RAW_DIR))

        email_files += list(extract_dir.rglob("*"))
    # Filter to actual email files (no .cmds files, etc.)
    return [f for f in email_files if f.is_file() and not f.name.endswith(".cmds")]


def process_and_save(eml_paths: list[Path], label: int, output_file: Path):
    """
    Parse each EML file, redact PII, and write one JSON record per email.

    Args:
        eml_paths: List of .eml file paths
        label: 1 for phishing, 0 for ham
        output_file: JSONL output path
    """
    # Add src to path for imports
    sys.path.insert(0, str(SRC_DIR.parent))

    from src.parser import EMLParser
    from src.redactor import PIIRedactor

    parser = EMLParser()
    redactor = PIIRedactor()

    skipped = 0
    written = 0

    with output_file.open("w", encoding="utf-8") as out:
        for i, path in enumerate(eml_paths):
            if i % 100 == 0 and i > 0:
                logger.info("  Processed %d / %d emails (label=%d)...", i, len(eml_paths), label)
            try:
                parsed = parser.parse_file(path)

                # Apply PII redaction even to the already-anonymized phishing emails —
                # belt-and-suspenders approach before training
                redacted_subject = redactor.redact_subject(parsed.subject)
                redacted_body = redactor.redact(parsed.body_text)

                text = f"Subject: {redacted_subject}\n\n{redacted_body}".strip()

                if len(text) < 30:
                    skipped += 1
                    continue

                record = {
                    "label": label,
                    "text": text,
                    "sender_domain": parsed.sender_domain,
                    "urgency_signal_count": parsed.urgency_signal_count,
                    "spf_fail": parsed.spf_result not in ("pass", None),
                    "dkim_fail": parsed.dkim_result not in ("pass", None),
                    "dmarc_fail": parsed.dmarc_result not in ("pass", None),
                    "has_html_only": parsed.has_html_only_body,
                    "has_mismatched_links": parsed.has_mismatched_links,
                    "url_count": len(parsed.urls),
                    "attachment_count": parsed.attachment_count,
                }
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
                written += 1

            except Exception as exc:
                logger.debug("Skipped %s: %s", path.name, exc)
                skipped += 1

    logger.info(
        "Saved %d records (label=%d) to %s. Skipped: %d",
        written, label, output_file.name, skipped
    )


def main():
    logger.info("=" * 60)
    logger.info("Email Intelligence — Dataset Downloader")
    logger.info("=" * 60)

    setup_dirs()

    # ── Phishing Pot (label=1) ─────────────────────────────────────────────────
    logger.info("\n[1/4] Cloning Phishing Pot repository...")
    phishing_pot_dir = clone_phishing_pot()
    phishing_eml_files = list((phishing_pot_dir / "email").rglob("*.eml"))
    logger.info("Found %d phishing .eml files", len(phishing_eml_files))

    # ── SpamAssassin ham (label=0) ─────────────────────────────────────────────
    logger.info("\n[2/4] Downloading SpamAssassin ham corpus...")
    ham_archives = download_ham_archives()
    print()  # newline after progress

    logger.info("\n[3/4] Extracting ham archives...")
    ham_files = extract_ham(ham_archives)
    logger.info("Found %d ham email files", len(ham_files))

    # ── Process + save ─────────────────────────────────────────────────────────
    logger.info("\n[4/4] Processing and saving datasets (applying PII redaction)...")
    process_and_save(phishing_eml_files, label=1, output_file=PROC_DIR / "phishing.jsonl")
    process_and_save(ham_files, label=0, output_file=PROC_DIR / "ham.jsonl")

    # Stats
    phishing_count = sum(1 for _ in (PROC_DIR / "phishing.jsonl").open())
    ham_count = sum(1 for _ in (PROC_DIR / "ham.jsonl").open())

    logger.info("\n%s", "=" * 60)
    logger.info("Dataset preparation complete!")
    logger.info("  Phishing emails : %d", phishing_count)
    logger.info("  Ham emails      : %d", ham_count)
    logger.info("  Total           : %d", phishing_count + ham_count)
    logger.info("\nNext step: python scripts/train.py")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
