from pathlib import Path

from src.model import SmishingClassifier
from src.parser import PhoneMessageParser
from src.phone_enrichment import PhoneEnricher
from src.redactor import PIIRedactor


def test_parser_extracts_basic_smishing_signals():
    parser = PhoneMessageParser(default_region="US")
    parsed = parser.parse(
        "Urgent: your package is on hold. Verify now at https://bit.ly/secure-check",
        sender_number="+14155550199",
    )

    assert parsed.urls == ["https://bit.ly/secure-check"]
    assert parsed.shortener_urls == ["https://bit.ly/secure-check"]
    assert parsed.urgency_signal_count >= 2
    assert "verify" in parsed.keyword_hits


def test_redactor_removes_direct_pii_patterns():
    redactor = PIIRedactor()
    redacted = redactor.redact("Call me at +1 415-555-0199 or email me@example.com")

    assert "[PHONE_NUMBER]" in redacted
    assert "[EMAIL]" in redacted


def test_classifier_uses_heuristic_without_trained_model():
    parser = PhoneMessageParser(default_region="US")
    enricher = PhoneEnricher()
    classifier = SmishingClassifier(model_dir=Path("/tmp/nonexistent-phone-model"))

    parsed = parser.parse(
        "Urgent! Your Coinbase wallet is locked. Verify now at https://bit.ly/reset",
        sender_number="+14155550199",
    )
    enrichment = enricher.enrich("+14155550199", default_region="US")
    score = classifier.score(parsed, parsed.message_text, enrichment)

    assert score.model_available is False
    assert score.probability >= 0.5
    assert score.risk_tier in {"MEDIUM", "HIGH", "CRITICAL"}
