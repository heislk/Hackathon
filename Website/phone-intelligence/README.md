# phone-intelligence

Privacy-first phone and SMS intelligence service for CryptoSecure.

This backend accepts:
- pasted sender numbers and SMS text
- uploaded screenshots or phone photos
- hybrid submissions that contain both typed text and an image

It then runs:
1. OCR extraction for screenshots when an image is supplied
2. phone-number parsing and enrichment with `phonenumbers`
3. PII redaction before model scoring
4. smishing classification with either:
   - a trained `joblib` scikit-learn classifier, or
   - a Hugging Face checkpoint, or
   - the built-in heuristic fallback when no trained model is present

## API

Run locally on port `8001`:

```bash
cd Website/phone-intelligence
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api:app --reload --port 8001
```

Main routes:
- `GET /health`
- `GET /model`
- `POST /scan`

`POST /scan` accepts either JSON or multipart form-data with:
- `phone_number`
- `message`
- `image` or `image_base64`
- `default_region`

## Training

The default training path uses only real, non-synthetic datasets.

Current first-party scripts support:
- `UCI SMS Spam Collection`
- `MOZNLP/MOZ-Smishing`
- optional `Sting9` API ingestion when you have a token
- optional manual CSV imports for other real SMS / smishing corpora

Build the corpus:

```bash
cd Website/phone-intelligence
. .venv/bin/activate
python scripts/download_dataset.py
```

Train and evaluate:

```bash
python scripts/train.py
```

Artifacts are written under `data/phone-intelligence/`:
- `processed/sms_corpus.jsonl`
- `splits/train.jsonl`
- `splits/val.jsonl`
- `splits/test.jsonl`
- `model/phone_classifier.joblib`
- `model/metadata.json`

`metadata.json` contains the measured validation/test metrics and the chosen threshold. Do not claim `97-99%` accuracy unless those metrics are actually achieved on the held-out test split you trained with.

## Website Integration

The Vite app reaches this service through `/api/phone-scan` in development. The shared dev runner at `Website/scripts/dev.mjs` will start this backend automatically when `phone-intelligence/.venv/bin/python` exists.

Useful commands:

```bash
npm run dev
npm run dev:phone
```
