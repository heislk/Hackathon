# CryptoSecure: Multi-Vector Threat Intelligence Platform

CryptoSecure is a comprehensive security platform designed to protect users across multiple digital vectors: email, phone (SMS), and on-chain (blockchain) activities. By combining advanced machine learning, real-time API enrichments, and privacy-first engineering, CryptoSecure provides a robust defense against phishing, smishing, and malicious blockchain interactions.

---

> [!IMPORTANT]
> **AI-Assisted Development**
> This project was architected and implemented with the assistance of **Agentic AI (Gemini + Claude + ChatGPT)**. AI was leveraged to design the cross-service boundaries, implement security heuristics, and refine the integrated user experience.

---

## Architecture Overview

The platform consists of three primary intelligence engines and a centralized web dashboard:

1.  **Email Intelligence**: Advanced phishing detection for `.eml` files.
2.  **Phone Intelligence**: SMS and sender analysis via text and screenshots.
3.  **On-Chain Intelligence**: Real-time blockchain forensics and risk scoring.
4.  **CryptoSecure Dashboard**: An integrated React-based frontend providing a unified risk interface.

---

## 📧 Email Intelligence

Privacy-first email phishing detection using fine-tuned transformer models and global threat feeds.

### Key Features
-   **Local Inference**: Uses a fine-tuned **DistilBERT** model trained on the `Phishing Pot` dataset.
-   **PII Redactor**: Automatically strips sensitive information (names, emails, phones, IPs, SSNs) using **Microsoft Presidio** before analysis.
-   **VirusTotal Enrichment**: Seamless integration with VirusTotal for real-time URL, domain, and attachment hash checking.
-   **Hybrid Scoring**: Combines ML confidence with multi-engine security labels to provide a unified risk score.

### Setup
```bash
cd email-intelligence
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn src.api:app --port 8000
```

---

## 📱 Phone Intelligence

Defends against smishing attacks by analyzing text messages and screenshots of mobile devices.

### Key Features
-   **Multi-Modal Input**: Accepts raw text, sender numbers, or screenshots of SMS threads.
-   **OCR Engine**: Extracts text from images of mobile devices for analysis.
-   **Phone Enrichment**: Uses the `phonenumbers` library to identify carrier info, geographic regions, and spoofing risks.
-   **Spam Classification**: Leverages specialized classifiers (sklearn/HuggingFace) trained on the `UCI SMS Spam` and `MOZ-Smishing` corpora.

### Setup
```bash
cd phone-intelligence
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api:app --port 8001
```

---

## 🔗 On-Chain Intelligence

A high-performance blockchain forensics layer providing deep visibility into EVM and UTXO activity.

### Key Features
-   **Multi-Provider Integration**: Aggregates intelligence from **Arkham Intelligence**, **Coinbase CDP**, **GoPlus Security**, and **Mempool.space**.
-   **Risk Scoring Heuristics**: Identifies zero-value poisoning attacks, interaction with mixers (e.g., Tornado Cash), and interaction with known phishing drained addresses.
-   **Enriched Activity**: Provides transaction history with human-readable labels and entity tagging.
-   **Phishing URL Protection**: Dedicated API for checking decentralized application (dApp) URLs against known scam databases.

### Setup
```bash
cd chain-intelligence
npm install
# Configure .env with API keys (ARKHAM_API_KEY, CDP_API_KEY, etc.)
npx ts-node server.ts
```

---

## 🌐 Website & Dashboard

The centralized command center for all threat intelligence. Built with **React** and **Vite** for a modern, responsive experience.

### Key Features
-   **Unified Risk Scan**: A single interface to scan any indicator (URL, Address, Email, or File).
-   **Real-Time Analytics**: Visualizes threat vectors and confidence levels.
-   **Wiki & Education**: Built-in security wiki providing context on detected threats.
-   **Mission-Driven Design**: Focused on empowering users with actionable security data.

### Run Locally
```bash
npm run dev
```

---

## Privacy & Security

CryptoSecure is built with a **Privacy-First** philosophy:
-   **Local Processing**: ML inference and PII redaction happen 100% locally or within private service boundaries.
-   **Non-PII Enrichment**: Only sanitized indicators (hashes, domains, redacted text) are sent to third-party enrichment APIs.
-   **Zero Storage**: Raw email content and images are processed in-memory and are never stored.

---

## Team & Credits
Developed for Hackathon 2026. Built with ❤️ and AI.
