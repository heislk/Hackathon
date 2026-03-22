# Email Intelligence — Phishing Detection

Privacy-first email phishing detection using **DistilBERT fine-tuned on the Phishing Pot dataset**, combined with **VirusTotal** URL/domain/hash checking inside the Python service.

## Architecture

```
.eml file upload
      │
      ▼
┌─────────────────────────────────┐  NOTHING sensitive leaves here
│  Python FastAPI Service         │  ← runs 100% locally
│  1. EML Parser                  │  extracts structure (domain-only, no full addresses)
│  2. PII Redactor (Presidio)     │  strips names, emails, phones, IPs, SSNs
│  3. DistilBERT Inference        │  scores redacted text → 0.0–1.0
│  4. Feature Extractor           │  pulls URLs, domains, attachment hashes, crypto addrs
│  5. VirusTotal Enrichment       │  sends only URLs, domains, hashes
└──────────┬──────────────────────┘
           │ returns: score + features only
           ▼
┌─────────────────────────────────┐
│  TypeScript CLI (scan_email.ts) │
│  └─ Prints the Python service's ML + VirusTotal hybrid score
└─────────────────────────────────┘
```

## Setup

### 1. Install Python dependencies
```bash
cd email-intelligence
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm   # required for Presidio NER
```

### 2. Download training data
```bash
python scripts/download_dataset.py
# Downloads: Phishing Pot (GitHub) + SpamAssassin ham corpus
# Output: data/processed/phishing.jsonl, data/processed/ham.jsonl
```

### 3. Fine-tune the model (~30–60 min on CPU, ~10 min GPU)
```bash
python scripts/train.py
# Output: model/ directory (265MB)
```

### 4. Evaluate (optional)
```bash
python scripts/evaluate.py
# Target: F1 ≥ 0.92
```

### 5. Start the API server
```bash
uvicorn src.api:app --reload --port 8000
```

### 6. Scan an email
```bash
cd ../chain-intelligence
npx ts-node scan_email.ts ../email-intelligence/tests/sample_emails/phishing_sample.eml
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `MODEL_DIR` | No | Path to saved model (default: `./model`) |
| `ENABLE_PII_REDACTION` | No | Set `false` to disable Presidio (not recommended) |
| `LOG_LEVEL` | No | `INFO` or `DEBUG` |

In `email-intelligence/.env`:

| Variable | Required | Description |
|---|---|---|
| `VIRUSTOTAL_API_KEY` | Optional | Free key from virustotal.com (500 req/day) |
| `ENABLE_VIRUSTOTAL_ENRICHMENT` | No | Set `false` to skip VirusTotal lookups even when a key exists |
| `VIRUSTOTAL_MIN_REQUEST_INTERVAL_MS` | No | Optional spacing between VT requests for rate limiting |

## Privacy Design

| What | How |
|---|---|
| Raw email content | Never stored — in-memory only |
| PII redaction | Microsoft Presidio (names, emails, phones, IPs, SSNs, credit cards) |
| Sent to VirusTotal | Only SHA256 hashes, domains, and URLs — never email body |
| Model training | Redaction applied before training + before inference |
| Logs | PII stripped before any log entry |
| Compliance | GDPR Article 25, CCPA, SOC 2 Type II compatible |

## Tests

```bash
cd email-intelligence
python -m pytest tests/ -v
```

## Unified Scoring Formula

```
finalScore = max(mlScore, vtScore)
if VirusTotal flags anything malicious, finalScore is lifted to at least 0.80
```

| Tier | Score Range |
|---|---|
| 🟢 CLEAN | < 0.25 |
| 🔵 LOW | 0.25 – 0.50 |
| 🟡 MEDIUM | 0.50 – 0.75 |
| 🟠 HIGH | 0.75 – 0.90 |
| 🔴 CRITICAL | ≥ 0.90 |
