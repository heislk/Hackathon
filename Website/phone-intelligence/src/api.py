from __future__ import annotations

import base64
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .model import SmishingClassifier
from .ocr import OCRExtractor
from .parser import PhoneMessageParser
from .phone_enrichment import PhoneEnricher
from .redactor import PIIRedactor

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Phone Intelligence - Smishing Detection API",
    description=(
        "Privacy-first SMS and smishing detection using OCR, phone-number enrichment, "
        "PII redaction, and a fine-tuned classifier when available."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

_ocr = OCRExtractor()
_parser = PhoneMessageParser(default_region=os.getenv("DEFAULT_PHONE_REGION", "US"))
_redactor = PIIRedactor()
_enricher = PhoneEnricher()
_classifier = SmishingClassifier()


class OCRResponse(BaseModel):
    backend: Optional[str] = None
    confidence: Optional[float] = None
    line_count: int = 0
    text: Optional[str] = None
    image_name: Optional[str] = None


class PhoneEnrichmentResponse(BaseModel):
    raw_input: str
    region_hint: str
    normalized_e164: Optional[str] = None
    formatted_national: Optional[str] = None
    formatted_international: Optional[str] = None
    formatted_rfc3966: Optional[str] = None
    country_code: Optional[int] = None
    national_number: Optional[int] = None
    region_code: Optional[str] = None
    number_type: str
    carrier: Optional[str] = None
    location: Optional[str] = None
    time_zones: list[str] = Field(default_factory=list)
    possible: bool
    valid: bool
    is_voip: bool
    is_toll_free: bool
    is_premium_rate: bool
    parse_error: Optional[str] = None
    risk_notes: list[str] = Field(default_factory=list)


class PhoneExplanationResponse(BaseModel):
    top_tokens: list[str] = Field(default_factory=list)
    urgency_signal_count: int = 0
    keyword_hits: list[str] = Field(default_factory=list)
    has_urls: bool = False
    has_shorteners: bool = False
    has_urgent_language: bool = False
    has_otp_triggers: bool = False
    phone_candidate_count: int = 0
    sender_valid: bool = False
    sender_possible: bool = False
    sender_voip: bool = False
    sender_toll_free: bool = False
    sender_premium_rate: bool = False
    sender_parse_error: Optional[str] = None
    ocr_backend: Optional[str] = None
    ocr_confidence: Optional[float] = None
    model_probability: float = 0.0
    heuristic_probability: float = 0.0


class PhoneFeaturesResponse(BaseModel):
    urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    phone_numbers: list[str] = Field(default_factory=list)
    shortener_urls: list[str] = Field(default_factory=list)
    money_mentions: list[str] = Field(default_factory=list)
    line_count: int = 0
    character_count: int = 0
    sender_number: Optional[str] = None
    message_preview: Optional[str] = None


class PhoneScanResponse(BaseModel):
    input_kind: str
    risk_tier: str
    is_smishing: bool
    confidence: str
    probability: float
    ml_score: float
    model_probability: float
    heuristic_probability: float
    model_available: bool
    model_version: str
    redacted: bool = True
    processed_at: str
    ocr: OCRResponse = Field(default_factory=OCRResponse)
    phone: PhoneEnrichmentResponse
    explanation: PhoneExplanationResponse
    features: PhoneFeaturesResponse


class HealthResponse(BaseModel):
    status: str
    model_available: bool
    ocr_available: bool
    model_dir: str


class ModelInfoResponse(BaseModel):
    model_version: str
    model_kind: str
    base_model: str
    model_available: bool
    default_region: str
    training_data: str


async def _read_request_payload(request: Request) -> dict:
    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        image = form.get("image") or form.get("file")
        image_bytes = None
        image_name = None
        if image is not None:
            image_bytes = await image.read()
            image_name = getattr(image, "filename", None)

        return {
            "phone_number": form.get("phone_number") or form.get("phoneNumber") or "",
            "normalized_phone_number": form.get("normalized_phone_number") or form.get("normalizedPhoneNumber") or "",
            "message": form.get("message") or form.get("text") or "",
            "default_region": form.get("default_region") or form.get("defaultRegion") or form.get("country") or os.getenv("DEFAULT_PHONE_REGION", "US"),
            "image_bytes": image_bytes,
            "image_name": image_name,
        }

    if "application/json" in content_type:
        payload = await request.json()
        image_bytes = None
        image_b64 = payload.get("image_base64") or payload.get("imageBase64")
        if image_b64:
            try:
                image_bytes = base64.b64decode(image_b64)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid base64 image payload.")
        return {
            "phone_number": payload.get("phone_number") or payload.get("phoneNumber") or "",
            "normalized_phone_number": payload.get("normalized_phone_number") or payload.get("normalizedPhoneNumber") or "",
            "message": payload.get("message") or payload.get("text") or "",
            "default_region": payload.get("default_region") or payload.get("defaultRegion") or payload.get("country") or os.getenv("DEFAULT_PHONE_REGION", "US"),
            "image_bytes": image_bytes,
            "image_name": payload.get("image_name") or payload.get("imageName"),
        }

    raise HTTPException(status_code=415, detail="Unsupported content type. Use JSON or multipart form-data.")


def _phone_to_response(enrichment) -> PhoneEnrichmentResponse:
    return PhoneEnrichmentResponse(**enrichment.to_dict())


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_available=_classifier.is_model_available(),
        ocr_available=_ocr.available(),
        model_dir=str(_classifier._model_dir.resolve()),
    )


@app.get("/model", response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    return ModelInfoResponse(
        model_version=_classifier.model_version(),
        model_kind=_classifier.model_kind(),
        base_model="distilbert-base-uncased or privacy-safe scikit-learn SMS classifier",
        model_available=_classifier.is_model_available(),
        default_region=os.getenv("DEFAULT_PHONE_REGION", "US"),
        training_data=(
            "Real SMS / smishing corpora such as UCI SMS Spam Collection, SmishTank, "
            "Sting9, MOZ-Smishing, and other non-synthetic labeled datasets"
        ),
    )


@app.post("/scan", response_model=PhoneScanResponse)
async def scan_phone(request: Request) -> PhoneScanResponse:
    start = time.monotonic()
    payload = await _read_request_payload(request)

    sender_number = str(payload.get("normalized_phone_number") or payload.get("phone_number") or "").strip()
    message_text = str(payload.get("message") or "").strip()
    default_region = str(payload.get("default_region") or os.getenv("DEFAULT_PHONE_REGION", "US")).strip() or "US"
    image_bytes = payload.get("image_bytes")
    image_name = payload.get("image_name") or "upload"

    source_kind = "text"
    ocr_result = None
    if image_bytes:
        source_kind = "image" if not message_text else "hybrid"
        try:
            ocr_result = _ocr.extract(image_bytes)
            if ocr_result.text:
                message_text = f"{message_text}\n{ocr_result.text}".strip() if message_text else ocr_result.text
        except Exception as exc:
            logger.error("OCR failed for %s: %s", image_name, exc)
            raise HTTPException(status_code=422, detail=f"Could not read image: {exc}")

    if not message_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Provide a message body, a phone screenshot, or both.",
        )

    parsed = _parser.parse(
        message_text,
        sender_number=sender_number or None,
        source_kind=source_kind,
        ocr_result=ocr_result,
    )

    primary_number = sender_number or (parsed.detected_phone_numbers[0] if parsed.detected_phone_numbers else "")
    enrichment = _enricher.enrich(primary_number, default_region=default_region)

    redacted_message = _redactor.redact(parsed.message_text, default_region=default_region)
    score = _classifier.score(parsed, redacted_message, enrichment)

    elapsed_ms = round((time.monotonic() - start) * 1000)
    logger.info(
        "Phone scan complete in %dms: prob=%.3f tier=%s model=%s sender_valid=%s",
        elapsed_ms,
        score.probability,
        score.risk_tier,
        score.model_available,
        enrichment.valid,
    )

    explanation = PhoneExplanationResponse(
        top_tokens=score.top_tokens,
        urgency_signal_count=parsed.urgency_signal_count,
        keyword_hits=parsed.keyword_hits,
        has_urls=bool(parsed.urls),
        has_shorteners=bool(parsed.shortener_urls),
        has_urgent_language=parsed.urgency_signal_count > 0,
        has_otp_triggers=any(
            token in redacted_message.lower()
            for token in ("otp", "one-time", "verification code", "security code")
        ),
        phone_candidate_count=len(parsed.detected_phone_numbers),
        sender_valid=enrichment.valid,
        sender_possible=enrichment.possible,
        sender_voip=enrichment.is_voip,
        sender_toll_free=enrichment.is_toll_free,
        sender_premium_rate=enrichment.is_premium_rate,
        sender_parse_error=enrichment.parse_error,
        ocr_backend=ocr_result.backend if ocr_result else None,
        ocr_confidence=ocr_result.confidence if ocr_result else None,
        model_probability=score.model_probability,
        heuristic_probability=score.heuristic_probability,
    )

    features = PhoneFeaturesResponse(
        urls=parsed.urls,
        domains=parsed.domains,
        phone_numbers=parsed.detected_phone_numbers,
        shortener_urls=parsed.shortener_urls,
        money_mentions=parsed.money_mentions,
        line_count=parsed.line_count,
        character_count=parsed.character_count,
        sender_number=enrichment.formatted_international or enrichment.normalized_e164 or primary_number or None,
        message_preview=redacted_message[:280] if redacted_message else None,
    )

    ocr_payload = OCRResponse(
        backend=ocr_result.backend if ocr_result else None,
        confidence=ocr_result.confidence if ocr_result else None,
        line_count=ocr_result.line_count if ocr_result else 0,
        text=_redactor.redact(ocr_result.text, default_region=default_region) if ocr_result and ocr_result.text else None,
        image_name=image_name if image_bytes else None,
    )

    return PhoneScanResponse(
        input_kind=source_kind,
        risk_tier=score.risk_tier,
        is_smishing=score.is_smishing,
        confidence=score.confidence,
        probability=score.probability,
        ml_score=score.model_probability,
        model_probability=score.model_probability,
        heuristic_probability=score.heuristic_probability,
        model_available=score.model_available,
        model_version=score.model_version,
        redacted=True,
        processed_at=datetime.now(timezone.utc).isoformat(),
        ocr=ocr_payload,
        phone=_phone_to_response(enrichment),
        explanation=explanation,
        features=features,
    )
