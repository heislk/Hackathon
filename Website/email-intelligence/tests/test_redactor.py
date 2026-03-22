"""
test_redactor.py — unit tests for the PII redactor.

Tests verify that:
  1. Email addresses are removed from text
  2. Phone numbers are redacted
  3. IP addresses are removed
  4. SSNs are redacted
  5. Credit card numbers are removed
  6. URLs and crypto addresses are PRESERVED (not redacted)
  7. verify_redacted() correctly identifies clean vs dirty text
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.redactor import PIIRedactor

redactor = PIIRedactor()


class TestEmailRedaction:
    def test_email_address_redacted(self):
        text = "Please reply to john.doe@company.com for assistance."
        result = redactor.redact(text)
        assert "john.doe@company.com" not in result
        assert "[EMAIL]" in result

    def test_multiple_emails_redacted(self):
        text = "From alice@example.com to bob@test.org with cc: carol@company.net"
        result = redactor.redact(text)
        assert "alice@example.com" not in result
        assert "bob@test.org" not in result


class TestPhoneRedaction:
    def test_us_phone_redacted(self):
        text = "Call us at 555-867-5309 for support."
        result = redactor.redact(text)
        assert "555-867-5309" not in result

    def test_formatted_phone_redacted(self):
        text = "Our number: (800) 123-4567"
        result = redactor.redact(text)
        assert "123-4567" not in result


class TestIPRedaction:
    def test_ipv4_redacted(self):
        text = "Originating IP: 192.168.1.50 detected."
        result = redactor.redact(text)
        assert "192.168.1.50" not in result

    def test_public_ip_redacted(self):
        text = "Connection from 104.21.45.67 blocked."
        result = redactor.redact(text)
        assert "104.21.45.67" not in result


class TestSSNRedaction:
    def test_ssn_redacted(self):
        text = "Your SSN 123-45-6789 has been verified."
        result = redactor.redact(text)
        assert "123-45-6789" not in result


class TestCreditCardRedaction:
    def test_credit_card_redacted(self):
        text = "Card number 4111 1111 1111 1111 was flagged."
        result = redactor.redact(text)
        assert "4111 1111 1111 1111" not in result


class TestURLPreservation:
    def test_urls_preserved(self):
        """URLs must NOT be redacted — they are critical phishing signals."""
        text = "Click here: https://paypal-secure.xyz/login to verify."
        result = redactor.redact(text)
        assert "paypal-secure.xyz" in result

    def test_http_url_preserved(self):
        text = "Visit http://evil-phishing.com/steal now!"
        result = redactor.redact(text)
        assert "evil-phishing.com" in result


class TestCryptoAddressPreservation:
    def test_eth_address_preserved(self):
        """Crypto addresses must NOT be redacted — they are safe public identifiers."""
        text = "Send ETH to 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
        result = redactor.redact(text)
        assert "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" in result


class TestVerifyRedacted:
    def test_clean_text_passes(self):
        clean = "Your account shows suspicious activity. Please verify your wallet."
        assert redactor.verify_redacted(clean) is True

    def test_email_in_text_fails(self):
        dirty = "Contact admin@site.com immediately."
        assert redactor.verify_redacted(dirty) is False

    def test_ip_in_text_fails(self):
        dirty = "Connection from 10.0.0.1"
        assert redactor.verify_redacted(dirty) is False

    def test_after_redaction_passes(self):
        raw = "Send details to hacker@evil.ru or call 555-123-4567"
        cleaned = redactor.redact(raw)
        assert redactor.verify_redacted(cleaned) is True
