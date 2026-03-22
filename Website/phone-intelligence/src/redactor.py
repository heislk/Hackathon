from __future__ import annotations

import logging
import os
import re
from functools import lru_cache

import phonenumbers

logger = logging.getLogger(__name__)
logging.getLogger("presidio-analyzer").setLevel(logging.ERROR)

_PRESIDIO_ENABLED = os.getenv("ENABLE_PII_REDACTION", "true").lower() != "false"

_URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_CARD_RE = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")


@lru_cache(maxsize=1)
def _get_presidio_engine():
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
        logger.warning("Presidio unavailable for phone redaction (%s); using regex fallback.", exc)
        return None, False


class PIIRedactor:
    def __init__(self) -> None:
        if _PRESIDIO_ENABLED:
            self._analyzer, self._presidio_available = _get_presidio_engine()
        else:
            self._analyzer = None
            self._presidio_available = False

    def redact(self, text: str, default_region: str = "US") -> str:
        if not text or not text.strip():
            return text

        redacted = self._redact_phone_numbers(text, default_region=default_region)
        redacted = _EMAIL_RE.sub("[EMAIL]", redacted)
        redacted = _IP_RE.sub("[IP_ADDRESS]", redacted)
        redacted = _SSN_RE.sub("[SSN]", redacted)
        redacted = _CARD_RE.sub("[CREDIT_CARD]", redacted)

        if self._presidio_available and self._analyzer:
            redacted = self._redact_with_presidio(redacted)

        return redacted

    def redact_subject(self, subject: str, default_region: str = "US") -> str:
        return self.redact(subject, default_region=default_region)

    def verify_redacted(self, text: str) -> bool:
        return not any(
            pattern.search(text)
            for pattern in (_EMAIL_RE, _IP_RE, _SSN_RE, _CARD_RE)
        )

    def _redact_phone_numbers(self, text: str, default_region: str = "US") -> str:
        try:
            matches = list(phonenumbers.PhoneNumberMatcher(text, default_region))
        except Exception:
            matches = []

        if not matches:
            return text

        pieces = []
        cursor = 0
        for match in matches:
            start = match.start
            end = match.end
            pieces.append(text[cursor:start])
            pieces.append("[PHONE_NUMBER]")
            cursor = end
        pieces.append(text[cursor:])
        return "".join(pieces)

    def _redact_with_presidio(self, text: str) -> str:
        try:
            from presidio_anonymizer import AnonymizerEngine
            from presidio_anonymizer.entities import OperatorConfig

            anonymizer = AnonymizerEngine()
            results = self._analyzer.analyze(  # type: ignore[union-attr]
                text=text,
                language="en",
                entities=["PERSON", "LOCATION", "EMAIL_ADDRESS", "PHONE_NUMBER", "IP_ADDRESS"],
                score_threshold=0.5,
            )
            operators = {
                "PERSON": OperatorConfig("replace", {"new_value": "[PERSON]"}),
                "LOCATION": OperatorConfig("replace", {"new_value": "[LOCATION]"}),
                "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL]"}),
                "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_NUMBER]"}),
                "IP_ADDRESS": OperatorConfig("replace", {"new_value": "[IP_ADDRESS]"}),
            }
            anonymized = anonymizer.anonymize(text=text, analyzer_results=results, operators=operators)
            return anonymized.text
        except Exception as exc:
            logger.warning("Presidio phone redaction failed (%s); keeping regex result.", exc)
            return text
