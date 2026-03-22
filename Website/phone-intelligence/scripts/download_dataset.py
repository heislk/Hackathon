#!/usr/bin/env python3
"""
phone-intelligence/scripts/download_dataset.py

Builds a training corpus from real SMS / smishing datasets only.

Default sources:
  1. UCI SMS Spam Collection
     - 5,574 real English SMS messages
     - label set: ham / spam
     - downloaded from the official UCI zip file

  2. MOZNLP/MOZ-Smishing
     - real Portuguese mobile-money SMS messages
     - this script filters to the SMS rows only
     - labels: Legitimate / Smishing
     - downloaded from the Hugging Face dataset CSV

Optional sources:
  3. Sting9 API
     - real malicious submissions only
     - requires a bearer token in PHONE_INTELLIGENCE_STING9_TOKEN
     - this is additive only; the core pipeline does not depend on it

  4. Manual CSV imports
     - for any other legally obtained real SMS/smishing CSV
     - columns are auto-detected when possible
     - useful for bringing in a local Mendeley export or a researcher-provided corpus

Output:
  processed/sms_corpus.jsonl
    Each row is a JSON object with:
      - text
      - label (0 benign, 1 malicious)
      - sender (if available)
      - source
      - attack_type / message_type where available

No synthetic data is generated or mixed in.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import zipfile
from pathlib import Path

import pandas as pd
import requests

from common import (
    counts_by_label,
    counts_by_source,
    dedupe_records,
    ensure_dir,
    merge_records,
    parse_csv_records,
    parse_moz_row,
    parse_sting9_row,
    parse_uci_line,
    save_jsonl,
    resolve_data_dir,
)

logger = logging.getLogger(__name__)

UCI_ZIP_URL = "https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip"
MOZ_CSV_URL = "https://huggingface.co/datasets/MOZNLP/MOZ-Smishing/resolve/main/test.csv"
STING9_API_URL = "https://api.sting9.org/api/v1/submissions"


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def download_file(url: str, dest: Path, headers: dict[str, str] | None = None) -> Path:
    ensure_dir(dest.parent)
    if dest.exists() and dest.stat().st_size > 0:
        logger.info("Using cached file: %s", dest)
        return dest

    logger.info("Downloading %s", url)
    with requests.get(url, headers=headers, stream=True, timeout=60) as response:
        response.raise_for_status()
        with dest.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 64):
                if chunk:
                    handle.write(chunk)
    return dest


def load_uci_sms(raw_dir: Path) -> list[dict]:
    zip_path = raw_dir / "uci_sms_spam_collection.zip"
    extract_dir = raw_dir / "uci_sms_spam_collection"
    ensure_dir(extract_dir)

    download_file(UCI_ZIP_URL, zip_path)

    if not any(extract_dir.iterdir()):
        logger.info("Extracting UCI SMS corpus to %s", extract_dir)
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(extract_dir)

    corpus_file = extract_dir / "SMSSpamCollection"
    if not corpus_file.exists():
        # Some zip viewers place the file one directory deeper.
        candidates = list(extract_dir.rglob("SMSSpamCollection"))
        if not candidates:
            raise FileNotFoundError("Could not find SMSSpamCollection inside the UCI zip")
        corpus_file = candidates[0]

    records: list[dict] = []
    with corpus_file.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            record = parse_uci_line(line)
            if record:
                record.update(
                    {
                        "source": "uci_sms_spam_collection",
                        "attack_type": "spam" if record["label"] == 1 else "ham",
                        "message_type": "sms",
                    }
                )
                records.append(record)

    logger.info("Loaded %d UCI SMS rows", len(records))
    return records


def load_moz_smishing(raw_dir: Path) -> list[dict]:
    csv_path = raw_dir / "moz_smishing_test.csv"
    download_file(MOZ_CSV_URL, csv_path)
    df = pd.read_csv(csv_path)

    records: list[dict] = []
    for row in df.to_dict(orient="records"):
        record = parse_moz_row(row)
        if record:
            records.append(record)

    logger.info(
        "Loaded %d MOZ smishing SMS rows from %s",
        len(records),
        csv_path.name,
    )
    return records


def load_sting9_sms(token: str, language: str = "en", page_size: int = 500, max_pages: int = 20) -> list[dict]:
    if not token:
        logger.warning("Skipping Sting9: PHONE_INTELLIGENCE_STING9_TOKEN is not set")
        return []

    headers = {"Authorization": f"Bearer {token}"}
    records: list[dict] = []
    page = 1

    while page <= max_pages:
        params = {
            "message_type": "sms",
            "language": language,
            "limit": page_size,
            "page": page,
        }
        logger.info("Fetching Sting9 page %d", page)
        response = requests.get(STING9_API_URL, headers=headers, params=params, timeout=60)
        if response.status_code in (401, 403):
            raise RuntimeError(
                "Sting9 API rejected the token. Check PHONE_INTELLIGENCE_STING9_TOKEN."
            )
        response.raise_for_status()
        payload = response.json()

        if isinstance(payload, list):
            items = payload
            next_page = None
        elif isinstance(payload, dict):
            items = payload.get("data") or payload.get("items") or payload.get("results") or []
            next_page = payload.get("next_page") or payload.get("nextPage") or payload.get("next")
        else:
            items = []
            next_page = None

        batch = 0
        for item in items:
            record = parse_sting9_row(item)
            if record:
                records.append(record)
                batch += 1

        logger.info("  parsed %d Sting9 SMS rows from page %d", batch, page)
        if next_page:
            try:
                page = int(next_page)
                continue
            except Exception:
                break

        if len(items) < page_size:
            break
        page += 1

    logger.info("Loaded %d Sting9 SMS rows", len(records))
    return records


def load_extra_csvs(paths: list[Path]) -> list[dict]:
    records: list[dict] = []
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(path)
        source_name = f"manual_csv:{path.stem}"
        parsed = parse_csv_records(path, source=source_name)
        logger.info("Loaded %d rows from %s", len(parsed), path.name)
        records.extend(parsed)
    return records


def build_corpus(
    include_uci: bool,
    include_moz: bool,
    include_sting9: bool,
    sting9_token: str,
    sting9_language: str,
    extra_csvs: list[Path],
    raw_dir: Path,
) -> list[dict]:
    groups: list[list[dict]] = []

    if include_uci:
        groups.append(load_uci_sms(raw_dir))
    if include_moz:
        groups.append(load_moz_smishing(raw_dir))
    if include_sting9:
        groups.append(load_sting9_sms(sting9_token, language=sting9_language))
    if extra_csvs:
        groups.append(load_extra_csvs(extra_csvs))

    records = merge_records(*groups)
    records = dedupe_records(records)
    return records


def write_manifest(path: Path, records: list[dict], sources: list[str]) -> None:
    manifest = {
        "total_records": len(records),
        "label_counts": counts_by_label(records),
        "source_counts": counts_by_source(records),
        "sources_requested": sources,
        "notes": [
            "Only real SMS / smishing data sources are included by default.",
            "No synthetic messages are generated or mixed into the corpus.",
            "Optional Sting9 access requires a bearer token and may return only malicious submissions.",
        ],
    }
    ensure_dir(path.parent)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download real SMS/smishing datasets into a training corpus.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=resolve_data_dir(),
        help="Base data directory (defaults to PHONE_INTELLIGENCE_DATA_DIR or data/phone-intelligence).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSONL path for the combined corpus.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Manifest JSON path summarizing the downloaded corpus.",
    )
    parser.add_argument("--skip-uci", action="store_true", help="Skip the UCI SMS corpus.")
    parser.add_argument("--skip-moz", action="store_true", help="Skip the MOZ smishing corpus.")
    parser.add_argument(
        "--include-sting9",
        action="store_true",
        default=os.getenv("PHONE_INTELLIGENCE_ENABLE_STING9", "false").lower() == "true",
        help="Include Sting9 SMS submissions if PHONE_INTELLIGENCE_STING9_TOKEN is set.",
    )
    parser.add_argument(
        "--sting9-token",
        default=os.getenv("PHONE_INTELLIGENCE_STING9_TOKEN", ""),
        help="Bearer token for the Sting9 API.",
    )
    parser.add_argument(
        "--sting9-language",
        default=os.getenv("PHONE_INTELLIGENCE_STING9_LANGUAGE", "en"),
        help="Sting9 language filter (default: en).",
    )
    parser.add_argument(
        "--extra-csv",
        action="append",
        default=(
            [
                value.strip()
                for value in os.getenv("PHONE_INTELLIGENCE_EXTRA_CSVS", "").split(",")
                if value.strip()
            ]
        ),
        help="Path to an additional real SMS/smishing CSV. Can be repeated.",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("PHONE_INTELLIGENCE_LOG_LEVEL", "INFO"),
        help="Logging level.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)

    paths = {
        "data_dir": args.data_dir,
        "raw_dir": args.data_dir / "raw",
        "processed_dir": args.data_dir / "processed",
    }
    for path in paths.values():
        ensure_dir(path)

    output_path = args.output or (paths["processed_dir"] / "sms_corpus.jsonl")
    manifest_path = args.manifest or (paths["processed_dir"] / "manifest.json")

    extra_csvs = [Path(p).expanduser().resolve() for p in args.extra_csv]
    requested_sources: list[str] = []
    if not args.skip_uci:
        requested_sources.append("uci")
    if not args.skip_moz:
        requested_sources.append("moz")
    if args.include_sting9:
        requested_sources.append("sting9")
    if extra_csvs:
        requested_sources.extend([f"csv:{path.stem}" for path in extra_csvs])

    logger.info("=" * 72)
    logger.info("Phone Intelligence Dataset Downloader")
    logger.info("=" * 72)

    records = build_corpus(
        include_uci=not args.skip_uci,
        include_moz=not args.skip_moz,
        include_sting9=args.include_sting9,
        sting9_token=args.sting9_token,
        sting9_language=args.sting9_language,
        extra_csvs=extra_csvs,
        raw_dir=paths["raw_dir"],
    )

    if not records:
        raise SystemExit("No records were loaded. Check your dataset source settings.")

    save_jsonl(records, output_path)
    write_manifest(manifest_path, records, requested_sources)

    logger.info("Saved corpus to %s", output_path)
    logger.info("Saved manifest to %s", manifest_path)
    logger.info("Total records : %d", len(records))
    logger.info("Label counts   : %s", counts_by_label(records))
    logger.info("Source counts  : %s", counts_by_source(records))
    logger.info("=" * 72)


if __name__ == "__main__":
    main()
