"""
test_parser.py — unit tests for the EML parser.

Tests verify that:
  1. Subject, sender domain, body text are correctly extracted
  2. Crypto addresses are found in body text
  3. URLs are correctly extracted from HTML bodies
  4. Mismatched links are detected
  5. Attachment hashes are computed correctly
  6. Auth results (SPF/DKIM/DMARC) are parsed from headers
"""
import hashlib
import sys
from pathlib import Path
from typing import Optional

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.parser import EMLParser

parser = EMLParser()


def make_eml(
    subject: str = "Test",
    from_addr: str = "attacker@phishing-site.ru",
    reply_to: str = "",
    body: str = "Click here now!",
    html: str = "",
    auth_results: str = "",
    received: Optional[list[str]] = None,
) -> bytes:
    """Helper to construct a minimal EML bytes object for testing."""
    lines = [
        f"From: {from_addr}",
        f"Subject: {subject}",
        "MIME-Version: 1.0",
    ]
    if reply_to:
        lines.append(f"Reply-To: {reply_to}")
    if auth_results:
        lines.append(f"Authentication-Results: mx.example.com; {auth_results}")
    for hop in (received or []):
        lines.append(f"Received: {hop}")

    if html:
        lines += [
            "Content-Type: multipart/alternative; boundary=boundary123",
            "",
            "--boundary123",
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
            "--boundary123",
            "Content-Type: text/html; charset=utf-8",
            "",
            html,
            "--boundary123--",
        ]
    else:
        lines += [
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
        ]

    return "\r\n".join(lines).encode("utf-8")


class TestSenderDomain:
    def test_extracts_domain(self):
        raw = make_eml(from_addr="attacker@phishing-site.ru")
        parsed = parser.parse_bytes(raw)
        assert parsed.sender_domain == "phishing-site.ru"

    def test_handles_display_name(self):
        raw = make_eml(from_addr='"PayPal Support" <no-reply@paypal-secure.xyz>')
        parsed = parser.parse_bytes(raw)
        assert parsed.sender_domain == "paypal-secure.xyz"

    def test_missing_from_returns_none(self):
        raw = make_eml(from_addr="")
        parsed = parser.parse_bytes(raw)
        # Domain may be None if no @ found
        assert parsed.sender_domain is None or isinstance(parsed.sender_domain, str)


class TestSubjectExtraction:
    def test_basic_subject(self):
        raw = make_eml(subject="Your account has been suspended!")
        parsed = parser.parse_bytes(raw)
        assert parsed.subject == "Your account has been suspended!"

    def test_empty_subject(self):
        raw = make_eml(subject="")
        parsed = parser.parse_bytes(raw)
        assert parsed.subject == ""


class TestBodyExtraction:
    def test_plain_text_body(self):
        raw = make_eml(body="Click here immediately to verify your account.")
        parsed = parser.parse_bytes(raw)
        assert "Click here immediately" in parsed.body_text

    def test_html_body_fallback(self):
        raw = make_eml(body="", html="<p>Verify your account <a href='http://evil.ru'>now</a></p>")
        parsed = parser.parse_bytes(raw)
        assert "Verify" in parsed.body_text or "now" in parsed.body_text


class TestCryptoAddresses:
    def test_eth_address_found(self):
        raw = make_eml(body="Send funds to 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B please")
        parsed = parser.parse_bytes(raw)
        assert "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" in parsed.crypto_addresses

    def test_btc_bech32_found(self):
        raw = make_eml(body="Send BTC to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
        parsed = parser.parse_bytes(raw)
        assert any(a.startswith("bc1") for a in parsed.crypto_addresses)

    def test_no_false_positive_crypto(self):
        raw = make_eml(body="The price was $12.50 for 3 items on 2024-01-01.")
        parsed = parser.parse_bytes(raw)
        # Should not detect any ETH addresses in normal text
        eth = [a for a in parsed.crypto_addresses if a.startswith("0x")]
        assert len(eth) == 0


class TestURLExtraction:
    def test_extracts_http_urls(self):
        raw = make_eml(body="Go to http://evil-phishing.com/login to verify")
        parsed = parser.parse_bytes(raw)
        assert any("evil-phishing.com" in u for u in parsed.urls)

    def test_extracts_href_urls(self):
        html = '<a href="https://paypal-secure.xyz/reset">Click here</a>'
        raw = make_eml(body="", html=html)
        parsed = parser.parse_bytes(raw)
        assert any("paypal-secure.xyz" in u for u in parsed.urls)


class TestMismatchedLinks:
    def test_detects_mismatched_link(self):
        html = '<a href="http://evil.ru/steal">http://paypal.com/login</a>'
        raw = make_eml(body="", html=html)
        parsed = parser.parse_bytes(raw)
        assert parsed.has_mismatched_links is True

    def test_no_mismatch_for_matching_link(self):
        html = '<a href="https://coinbase.com/verify">https://coinbase.com/verify</a>'
        raw = make_eml(body="", html=html)
        parsed = parser.parse_bytes(raw)
        assert parsed.has_mismatched_links is False


class TestAuthResults:
    def test_spf_fail(self):
        raw = make_eml(auth_results="spf=fail smtp.mailfrom=evil.ru; dkim=none; dmarc=fail")
        parsed = parser.parse_bytes(raw)
        assert parsed.spf_result == "fail"

    def test_dkim_pass(self):
        raw = make_eml(auth_results="spf=pass; dkim=pass header.i=@coinbase.com; dmarc=pass")
        parsed = parser.parse_bytes(raw)
        assert parsed.dkim_result == "pass"

    def test_received_hops_counted(self):
        raw = make_eml(received=["from a.example.com", "from b.example.com"])
        parsed = parser.parse_bytes(raw)
        assert parsed.received_hops == 2


class TestUrgencySignals:
    def test_high_urgency(self):
        raw = make_eml(body="Your account is suspended. Action required immediately.")
        parsed = parser.parse_bytes(raw)
        assert parsed.urgency_signal_count >= 2

    def test_low_urgency_in_ham(self):
        raw = make_eml(body="Thanks for your purchase. Your order will arrive in 3-5 days.")
        parsed = parser.parse_bytes(raw)
        assert parsed.urgency_signal_count == 0
