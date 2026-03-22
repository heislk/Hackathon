"""
email-intelligence/src/api.py

FastAPI REST Service — the interface between the Python ML pipeline and
the TypeScript orchestrator (chain-intelligence/scan_email.ts).

ENDPOINTS:
  POST /scan     Upload an .eml file → returns ML score + VirusTotal hybrid score
  GET  /health   Service health check + model status
  GET  /model    Model version + training metadata

PRIVACY ARCHITECTURE:
  1. EML bytes are received and held in memory only (never written to disk)
  2. parser.py extracts structured fields (domain-only, no full addresses)
  3. redactor.py strips all PII from text fields
  4. model.py scores the redacted text
  5. VirusTotal checks safe indicators only: URLs, domains, hashes
  6. Response returns scores, features, redacted=true
  7. No email content, no PII, no raw text appears in the response or logs

  This means the TypeScript side can safely log the full response without
  any privacy concerns.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .parser import EMLParser
from .redactor import PIIRedactor
from .model import PhishingClassifier
from .virustotal import VirusTotalClient

# ─── Logging setup ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Email Intelligence — Phishing Detection API",
    description=(
        "Privacy-first email phishing detection using DistilBERT fine-tuned on "
        "the Phishing Pot dataset. All PII is redacted locally before any processing. "
        "Raw email content is never stored, transmitted, or logged."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ─── Shared instances (initialized once at startup) ───────────────────────────

_parser = EMLParser()
_redactor = PIIRedactor()
_classifier = PhishingClassifier(model_dir=Path(os.getenv("MODEL_DIR", "./model")))
_vt_client = VirusTotalClient()


def _score_to_tier(score: float) -> str:
    if score >= 0.90:
        return "CRITICAL"
    if score >= 0.75:
        return "HIGH"
    if score >= 0.50:
        return "MEDIUM"
    if score >= 0.25:
        return "LOW"
    return "CLEAN"


def _confidence_from_score(score: float) -> str:
    return "HIGH" if score < 0.25 or score > 0.75 else "MEDIUM"


# ─── Response models ──────────────────────────────────────────────────────────

class ScanExplanation(BaseModel):
    """Explainability fields — WHY the model scored this email as it did."""
    top_tokens: list[str]
    """Tokens with highest attention weight — drove the classification decision."""

    trusted_sender_domain: bool
    """True when the sender domain matches a trusted exchange/payment brand domain."""

    urgency_signal_count: int
    """Number of urgency phrases found (e.g. 'immediately', 'suspended', 'verify now')."""

    suspicious_sender_domain: bool
    """True if sender domain does not match one of the known legitimate exchange domains."""

    reply_to_mismatch: bool
    """True if Reply-To domain differs from From: domain — classic phishing technique."""

    spf_fail: bool
    dkim_fail: bool
    dmarc_fail: bool
    """Email authentication failures — strong phishing indicators."""

    has_html_only_body: bool
    """True if email has no plain-text part — common in phishing HTML templates."""

    has_mismatched_links: bool
    """True if any link's display text shows a different domain from the actual href."""

    attachment_count: int
    received_hops: int
    virus_total_flagged: bool
    virus_total_hits: int


class ExtractedFeatures(BaseModel):
    """Non-PII features extracted from the email — safe to log and transmit."""
    urls: list[str]
    domains: list[str]
    attachment_hashes: list[str]    # SHA256 hex strings — safe for VirusTotal lookup
    attachment_names: list[str]
    crypto_addresses: list[str]     # ETH/BTC/SOL addresses found in body


class VirusTotalUrlResult(BaseModel):
    url: str
    domain: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_categories: list[str] = Field(default_factory=list)
    is_malicious: bool
    last_analysis_date: Optional[str] = None
    permalink: str


class VirusTotalDomainResult(BaseModel):
    domain: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_categories: list[str] = Field(default_factory=list)
    is_malicious: bool
    last_analysis_date: Optional[str] = None
    permalink: str


class VirusTotalHashResult(BaseModel):
    sha256: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_name: Optional[str] = None
    file_type: Optional[str] = None
    threat_categories: list[str] = Field(default_factory=list)
    is_malicious: bool
    last_analysis_date: Optional[str] = None


class VirusTotalSummary(BaseModel):
    configured: bool
    url_results: list[VirusTotalUrlResult] = Field(default_factory=list)
    domain_results: list[VirusTotalDomainResult] = Field(default_factory=list)
    hash_results: list[VirusTotalHashResult] = Field(default_factory=list)
    vt_score: float
    any_malicious: bool
    all_threat_categories: list[str] = Field(default_factory=list)
    checked_items: int


class ScanResponse(BaseModel):
    """Full response from the /scan endpoint."""
    ml_score: float
    """DistilBERT phishing probability (0.0 = legitimate, 1.0 = phishing)."""

    ml_risk_tier: str
    ml_is_phishing: bool
    ml_confidence: str

    vt_score: float
    virus_total: Optional[VirusTotalSummary] = None

    risk_tier: str
    """Final hybrid tier: CLEAN / LOW / MEDIUM / HIGH / CRITICAL"""

    is_phishing: bool
    """True if the hybrid score is ≥ 0.50 (default decision boundary)."""

    confidence: str
    """HIGH / MEDIUM — reflects how far from the 0.5 boundary the hybrid score is."""

    hybrid_score: float

    explanation: ScanExplanation
    extracted_features: ExtractedFeatures

    redacted: bool = True
    """Always True — confirms PII was stripped before model inference."""

    model_version: str
    processed_at: str


class HealthResponse(BaseModel):
    status: str
    model_available: bool
    model_dir: str


class ModelInfoResponse(BaseModel):
    model_version: str
    base_model: str
    model_available: bool
    training_data: str


# ─── Trusted domain list (not phishing) ───────────────────────────────────────
# Used to flag when the sender domain does NOT match known-good exchange domains.
_TRUSTED_DOMAINS = {
    "coinbase.com", "gemini.com", "kraken.com", "binance.com",
    "robinhood.com", "crypto.com", "paypal.com", "apple.com",
    "google.com", "microsoft.com", "amazon.com", "chase.com",
}


def _is_trusted_sender_domain(domain: Optional[str]) -> bool:
    return bool(domain) and any(str(domain).endswith(trusted) for trusted in _TRUSTED_DOMAINS)


def _all_authentication_passed(parsed_email) -> bool:
    return parsed_email.spf_result == "pass" and parsed_email.dkim_result == "pass" and parsed_email.dmarc_result == "pass"


def _normalize_ml_score(parsed_email, phishing_score: float, vt_score: float, vt_configured: bool) -> float:
    """
    Trust-aware calibration:
    - Keep the raw ML score for suspicious mail.
    - Lower the score only when the sender domain is trusted, authentication passes,
      the link profile looks consistent, and VirusTotal is also quiet.
    """
    trusted_sender = _is_trusted_sender_domain(parsed_email.sender_domain)
    auth_passed = _all_authentication_passed(parsed_email)
    clean_link_profile = not parsed_email.has_mismatched_links and parsed_email.reply_to_domain is None

    if trusted_sender and auth_passed and clean_link_profile and (not vt_configured or vt_score <= 0.25):
        # This still respects the model signal, but avoids treating clearly legitimate,
        # fully authenticated mail as CRITICAL just because it uses warning language.
        return min(phishing_score, 0.20 + (vt_score * 0.25))

    if trusted_sender and auth_passed and (not vt_configured or vt_score <= 0.15):
        return min(phishing_score, 0.35 + (vt_score * 0.25))

    return phishing_score


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, summary="Health check")
async def health():
    """
    Returns service status and whether the trained model is ready.
    If model_available is False, train the model first with `python scripts/train.py`.
    """
    return HealthResponse(
        status="ok",
        model_available=_classifier.is_model_available(),
        model_dir=str(_classifier._model_dir.resolve()),
    )


@app.get("/model", response_model=ModelInfoResponse, summary="Model metadata")
async def model_info():
    """Returns metadata about the loaded phishing detection model."""
    return ModelInfoResponse(
        model_version="distilbert-phishing-v1",
        base_model="distilbert-base-uncased (HuggingFace)",
        model_available=_classifier.is_model_available(),
        training_data="Phishing Pot (rf-peixoto/phishing_pot) + SpamAssassin ham corpus",
    )


@app.on_event("shutdown")
async def shutdown_vt_client():
    await _vt_client.aclose()


@app.post("/scan", response_model=ScanResponse, summary="Scan an EML file for phishing")
async def scan_email(file: UploadFile = File(..., description="The .eml file to analyze")):
    """
    Upload and analyze an EML email file for phishing indicators.

    **Privacy guarantees:**
    - The raw email file is held in memory only for the duration of this request
    - All PII (email addresses, names, phone numbers, IPs) is redacted before model inference
    - The response never contains raw email content, only structured features and scores
    - No email data is written to disk or stored anywhere

    **Returns:**
    - `ml_score`: DistilBERT phishing probability (0.0–1.0)
    - `vt_score`: VirusTotal malicious fraction over checked URLs/domains/hashes
    - `risk_tier`: CLEAN / LOW / MEDIUM / HIGH / CRITICAL
    - `explanation`: Which signals drove the score
    - `extracted_features`: URLs, domains, attachment hashes, crypto addresses (safe to transmit)
    - `virus_total`: Detailed URL/domain/hash reputation results when configured
    """
    if not file.filename or not file.filename.lower().endswith(".eml"):
        raise HTTPException(
            status_code=400,
            detail="Only .eml files are supported. Please upload an email in .eml format."
        )

    start = time.monotonic()

    # ── Step 1: Read file into memory ─────────────────────────────────────────
    raw_bytes = await file.read()
    logger.info("Received EML file: %s (%d bytes)", file.filename, len(raw_bytes))

    # ── Step 2: Parse EML structure ───────────────────────────────────────────
    try:
        parsed = _parser.parse_bytes(raw_bytes)
    except Exception as exc:
        logger.error("Failed to parse EML: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not parse EML file: {exc}")

    # ── Step 3: Redact PII from text fields ───────────────────────────────────
    # CRITICAL: redaction MUST happen before any text is passed to the model,
    # logged, or included in any response.
    redacted_subject = _redactor.redact_subject(parsed.subject)
    redacted_body = _redactor.redact(parsed.body_text)

    logger.debug("Redaction complete. Proceeding with model inference.")

    # ── Step 4: Score with DistilBERT ─────────────────────────────────────────
    model_input = f"Subject: {redacted_subject}\n\n{redacted_body}"

    if not _classifier.is_model_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Phishing detection model not available. "
                "Run 'python scripts/train.py' from the email-intelligence/ directory first."
            )
        )

    phishing_score = _classifier.score(model_input)

    # ── Step 5: VirusTotal enrichment on safe indicators only ────────────────
    vt_domains = list(dict.fromkeys(
        [d for d in [parsed.sender_domain, parsed.reply_to_domain, *parsed.domains] if d]
    ))
    vt_summary = await _vt_client.scan_email_features(
        urls=parsed.urls[:10],
        hashes=parsed.attachment_hashes[:10],
        domains=vt_domains[:10],
        max_checks=5,
    )

    normalized_ml_score = _normalize_ml_score(
        parsed,
        phishing_score.probability,
        vt_summary.vt_score,
        vt_summary.configured,
    )

    # Hybrid decision: ML score is the base, VT can lift the final score.
    hybrid_score = max(normalized_ml_score, vt_summary.vt_score)
    if vt_summary.any_malicious:
        hybrid_score = max(hybrid_score, 0.80)
    hybrid_score = round(min(1.0, hybrid_score), 4)
    hybrid_risk_tier = _score_to_tier(hybrid_score)
    hybrid_is_phishing = hybrid_score >= 0.50
    hybrid_confidence = _confidence_from_score(hybrid_score)

    # ── Step 6: Compute explanation signals ───────────────────────────────────
    suspicious_sender = (
        parsed.sender_domain is not None
        and not any(
            parsed.sender_domain.endswith(d) for d in _TRUSTED_DOMAINS
        )
    )

    reply_to_mismatch = (
        parsed.reply_to_domain is not None
        and parsed.sender_domain is not None
        and parsed.reply_to_domain != parsed.sender_domain
    )

    explanation = ScanExplanation(
        top_tokens=phishing_score.top_tokens,
        trusted_sender_domain=_is_trusted_sender_domain(parsed.sender_domain),
        urgency_signal_count=parsed.urgency_signal_count,
        suspicious_sender_domain=suspicious_sender,
        reply_to_mismatch=reply_to_mismatch,
        spf_fail=parsed.spf_result not in ("pass", None),
        dkim_fail=parsed.dkim_result not in ("pass", None),
        dmarc_fail=parsed.dmarc_result not in ("pass", None),
        has_html_only_body=parsed.has_html_only_body,
        has_mismatched_links=parsed.has_mismatched_links,
        attachment_count=parsed.attachment_count,
        received_hops=parsed.received_hops,
        virus_total_flagged=vt_summary.any_malicious,
        virus_total_hits=sum(
            1
            for item in (
                [*vt_summary.url_results, *vt_summary.domain_results, *vt_summary.hash_results]
            )
            if item.is_malicious
        ),
    )

    features = ExtractedFeatures(
        urls=parsed.urls[:50],               # cap at 50 URLs
        domains=parsed.domains[:20],
        attachment_hashes=parsed.attachment_hashes,
        attachment_names=parsed.attachment_names,
        crypto_addresses=parsed.crypto_addresses,
    )

    elapsed = round((time.monotonic() - start) * 1000)
    logger.info(
        "Scan complete in %dms: ml=%.3f normalized_ml=%.3f vt=%.3f hybrid=%.3f tier=%s is_phishing=%s",
        elapsed,
        phishing_score.probability,
        normalized_ml_score,
        vt_summary.vt_score,
        hybrid_score,
        hybrid_risk_tier,
        hybrid_is_phishing,
    )

    return ScanResponse(
        ml_score=phishing_score.probability,
        ml_risk_tier=phishing_score.risk_tier,
        ml_is_phishing=phishing_score.is_phishing,
        ml_confidence=phishing_score.confidence,
        vt_score=vt_summary.vt_score,
        virus_total=VirusTotalSummary(
            configured=vt_summary.configured,
            url_results=[VirusTotalUrlResult(**vars(item)) for item in vt_summary.url_results],
            domain_results=[VirusTotalDomainResult(**vars(item)) for item in vt_summary.domain_results],
            hash_results=[VirusTotalHashResult(**vars(item)) for item in vt_summary.hash_results],
            vt_score=vt_summary.vt_score,
            any_malicious=vt_summary.any_malicious,
            all_threat_categories=vt_summary.all_threat_categories,
            checked_items=vt_summary.checked_items,
        ),
        risk_tier=hybrid_risk_tier,
        is_phishing=hybrid_is_phishing,
        confidence=hybrid_confidence,
        hybrid_score=hybrid_score,
        explanation=explanation,
        extracted_features=features,
        redacted=True,
        model_version=phishing_score.model_version,
        processed_at=datetime.now(timezone.utc).isoformat(),
    )
