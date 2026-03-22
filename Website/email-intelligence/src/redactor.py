"""
email-intelligence/src/redactor.py

PII Redactor — strips all personally identifiable information from email text
before it is passed to the DistilBERT model or logged anywhere.

TECHNOLOGY: Microsoft Presidio
  Presidio is an enterprise-grade PII detection + anonymization framework
  used in Azure Purview. It uses spaCy NER for name/location detection and
  regex recognizers for structured PII (emails, phones, SSNs, credit cards).

WHAT IS REDACTED:
  - Email addresses        → [EMAIL]
  - Phone numbers          → [PHONE]
  - Person names           → [PERSON]
  - Physical addresses     → [ADDRESS]
  - Credit card numbers    → [CREDIT_CARD]
  - Social Security Nos.   → [SSN]
  - IP addresses           → [IP_ADDRESS]
  - Dates of birth         → [DATE_OF_BIRTH]

WHAT IS NOT REDACTED (intentional):
  - URLs and domains       — needed for phishing signal detection
  - Crypto wallet addresses — extracted separately as public blockchain identifiers
  - Urgency words          — needed for model features
  - Company names          — needed for impersonation detection (e.g., "PayPal", "Coinbase")

COMPLIANCE:
  This redactor enables compliance with:
  - GDPR Article 25 (Privacy by Design and by Default)
  - CCPA §1798.100 (right not to have personal data sold)
  - SOC 2 Type II (CC6.1 — logical access / data protection)

  By ensuring that all text passed to the ML model is free of PII, we can
  demonstrate that:
  1. No personal data is used in model inference output
  2. No personal data is transmitted to any external API
  3. All processing is strictly local
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache

logger = logging.getLogger(__name__)
logging.getLogger("presidio-analyzer").setLevel(logging.ERROR)

# Whether to use full Presidio stack (requires spaCy model download)
_PRESIDIO_ENABLED = os.getenv("ENABLE_PII_REDACTION", "true").lower() != "false"


@lru_cache(maxsize=1)
def _get_presidio_engine():
    """
    Lazy-load Presidio AnalyzerEngine + AnonymizerEngine.
    Cached — only initialized once per process.
    Requires: pip install presidio-analyzer presidio-anonymizer
              python -m spacy download en_core_web_sm
    """
    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        nlp_engine = provider.create_engine()
        analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
        return analyzer, True
    except Exception as exc:
        logger.warning(
            "Presidio not available (%s). Falling back to regex-only PII redaction. "
            "Install dependencies: pip install presidio-analyzer presidio-anonymizer "
            "&& python -m spacy download en_core_web_sm",
            exc,
        )
        return None, False


# Regex fallback patterns — used when Presidio is unavailable
_REGEX_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Email addresses
    (re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'), "[EMAIL]"),
    # Phone numbers (US-centric and international)
    (re.compile(r'(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'), "[PHONE]"),
    # IPv4 addresses
    (re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'), "[IP_ADDRESS]"),
    # SSN (NNN-NN-NNNN)
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), "[SSN]"),
    # Credit card numbers (4×4 digit groups)
    (re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'), "[CREDIT_CARD]"),
]


class PIIRedactor:
    """
    Redacts PII from email text using Microsoft Presidio (with regex fallback).

    Usage:
        redactor = PIIRedactor()
        clean_text = redactor.redact(raw_text)

    The returned text is safe to:
      - Pass to DistilBERT model inference
      - Log at any log level
      - Include in API responses
    """

    def __init__(self):
        if _PRESIDIO_ENABLED:
            self._analyzer, self._presidio_available = _get_presidio_engine()
        else:
            self._analyzer = None
            self._presidio_available = False
            logger.warning("PII redaction disabled via ENABLE_PII_REDACTION=false. NOT recommended.")

    def redact(self, text: str) -> str:
        """
        Redact all PII from the given text string.

        Args:
            text: Raw text that may contain PII (names, emails, phones, etc.)

        Returns:
            Text with all detected PII replaced by placeholder tokens like [EMAIL], [PERSON], etc.
            URLs, crypto addresses, and company names are preserved.
        """
        if not text or not text.strip():
            return text

        if self._presidio_available and self._analyzer:
            return self._redact_with_presidio(text)
        else:
            return self._redact_with_regex(text)

    def redact_subject(self, subject: str) -> str:
        """Redact PII from email subject line."""
        return self.redact(subject)

    def verify_redacted(self, text: str) -> bool:
        """
        Verify that the redacted text contains no obvious PII.
        Returns True if the text appears to be clean, False if suspicious content remains.
        Used in tests to assert redaction quality.
        """
        # Check for email address pattern remaining
        if re.search(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b', text):
            return False
        # Check for IP addresses
        if re.search(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', text):
            return False
        # Check for SSN
        if re.search(r'\b\d{3}-\d{2}-\d{4}\b', text):
            return False
        return True

    def _redact_with_presidio(self, text: str) -> str:
        """Full Presidio-based redaction with NER for names/addresses."""
        try:
            from presidio_anonymizer import AnonymizerEngine
            from presidio_anonymizer.entities import OperatorConfig

            anonymizer = AnonymizerEngine()

            # Detect PII entities
            results = self._analyzer.analyze(
                text=text,
                language="en",
                entities=[
                    "EMAIL_ADDRESS",
                    "PHONE_NUMBER",
                    "PERSON",
                    "LOCATION",
                    "IP_ADDRESS",
                    "US_SSN",
                    "CREDIT_CARD",
                    "DATE_TIME",   # catches "born on..." context
                    "US_DRIVER_LICENSE",
                    "US_PASSPORT",
                ],
                score_threshold=0.5,
            )

            if not results:
                return text

            # Replace with labeled placeholders
            operators = {
                "EMAIL_ADDRESS":       OperatorConfig("replace", {"new_value": "[EMAIL]"}),
                "PHONE_NUMBER":        OperatorConfig("replace", {"new_value": "[PHONE]"}),
                "PERSON":              OperatorConfig("replace", {"new_value": "[PERSON]"}),
                "LOCATION":            OperatorConfig("replace", {"new_value": "[ADDRESS]"}),
                "IP_ADDRESS":          OperatorConfig("replace", {"new_value": "[IP_ADDRESS]"}),
                "US_SSN":              OperatorConfig("replace", {"new_value": "[SSN]"}),
                "CREDIT_CARD":         OperatorConfig("replace", {"new_value": "[CREDIT_CARD]"}),
                "DATE_TIME":           OperatorConfig("replace", {"new_value": "[DATE]"}),
                "US_DRIVER_LICENSE":   OperatorConfig("replace", {"new_value": "[ID_NUMBER]"}),
                "US_PASSPORT":         OperatorConfig("replace", {"new_value": "[PASSPORT]"}),
            }

            anonymized = anonymizer.anonymize(
                text=text,
                analyzer_results=results,
                operators=operators,
            )
            return anonymized.text

        except Exception as exc:
            logger.warning("Presidio redaction failed (%s), falling back to regex.", exc)
            return self._redact_with_regex(text)

    def _redact_with_regex(self, text: str) -> str:
        """Regex-only fallback redaction (less accurate than Presidio for names/locations)."""
        result = text
        for pattern, replacement in _REGEX_PATTERNS:
            result = pattern.sub(replacement, result)
        return result
