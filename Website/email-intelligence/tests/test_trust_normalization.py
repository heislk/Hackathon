from pathlib import Path

import pytest

from src.api import _all_authentication_passed, _is_trusted_sender_domain, _normalize_ml_score
from src.model import PhishingClassifier
from src.parser import EMLParser
from src.redactor import PIIRedactor


REPO_ROOT = Path(__file__).resolve().parents[2]
EMAIL_ROOT = REPO_ROOT / "email-intelligence"
MODEL_DIR = EMAIL_ROOT / "model"


def _score_email(path: Path) -> tuple[object, float, float]:
    parser = EMLParser()
    redactor = PIIRedactor()
    classifier = PhishingClassifier(model_dir=MODEL_DIR)

    parsed = parser.parse_bytes(path.read_bytes())
    redacted = f"Subject: {redactor.redact_subject(parsed.subject)}\n\n{redactor.redact(parsed.body_text)}"
    raw_score = classifier.score(redacted).probability
    normalized_score = _normalize_ml_score(parsed, raw_score, 0.10, True)
    return parsed, raw_score, normalized_score


def test_trusted_coinbase_mail_is_downweighted():
    parsed, raw_score, normalized_score = _score_email(REPO_ROOT / "Your account has been locked.eml")

    assert _is_trusted_sender_domain(parsed.sender_domain)
    assert _all_authentication_passed(parsed)
    assert raw_score > 0.9
    assert normalized_score < 0.5
    assert normalized_score < raw_score


def test_phishing_mail_is_not_downweighted():
    parsed, raw_score, normalized_score = _score_email(EMAIL_ROOT / "tests/sample_emails/phishing_sample.eml")

    assert not _is_trusted_sender_domain(parsed.sender_domain)
    assert normalized_score == pytest.approx(raw_score, rel=0, abs=1e-9)
    assert normalized_score > 0.9
