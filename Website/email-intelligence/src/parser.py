"""
email-intelligence/src/parser.py

EML Parser — extracts structured, privacy-safe fields from raw .eml files.

PRIVACY DESIGN:
  - Full email addresses (To:, From:) are NEVER stored or returned — only domain portions.
  - IP addresses in Received: headers are dropped.
  - Raw full headers are not exposed in the output.
  - Attachment content is never read — only SHA256 hashes are computed.
  - This module is the first stage in the pipeline; redactor.py processes
    the text outputs before they reach any model or external service.
"""

from __future__ import annotations

import email
import hashlib
import re
import logging
from dataclasses import dataclass, field
from email import policy
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# --- Regex patterns -------------------------------------------------------

# Match ETH/EVM addresses (0x + 40 hex chars)
_RE_ETH = re.compile(r'\b0x[0-9a-fA-F]{40}\b')

# Match Bitcoin legacy addresses (P2PKH / P2SH)
_RE_BTC_LEGACY = re.compile(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b')

# Match Bitcoin Bech32 addresses
_RE_BTC_BECH32 = re.compile(r'\bbc1[a-z0-9]{6,87}\b')

# Match Solana addresses (base58, 32–44 chars)
_RE_SOL = re.compile(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b')

# Extract domain from email address
_RE_EMAIL_DOMAIN = re.compile(r'@([\w.\-]+)')

# Urgency words commonly found in phishing
_URGENCY_WORDS = {
    "urgent", "immediately", "suspended", "verify", "confirm", "limited",
    "expire", "action required", "account closed", "click here", "unusual activity",
    "compromised", "unauthorized", "locked", "restricted", "failure to act",
    "within 24 hours", "within 48 hours", "your account", "security alert",
    "update your information", "validate", "reactivate", "won't be able to access"
}


@dataclass
class ParsedEmail:
    """
    Structured representation of an EML file with all PII stripped.

    Note: This is the OUTPUT of parser.py. It still may contain text fragments
    with PII (e.g., names in the body). The redactor.py module must be applied
    to `body_text` and `subject` before passing to the ML model or any log.
    """

    # --- Header fields (domain-only, no full addresses) ---
    sender_domain: Optional[str]       # e.g. "paypal-security.ru" never "user@paypal-security.ru"
    reply_to_domain: Optional[str]     # Reply-To: domain if different from sender
    subject: str                       # Subject line (may still contain PII — redact before use)
    date: Optional[str]                # RFC2822 date string

    # --- Authentication results (from headers) ---
    spf_result: Optional[str]          # "pass", "fail", "softfail", "neutral", "none"
    dkim_result: Optional[str]         # "pass", "fail", "none"
    dmarc_result: Optional[str]        # "pass", "fail", "none"
    received_hops: int                 # Number of Received: headers (routing chain length)

    # --- Body content (requires redaction before model/logging) ---
    body_text: str                     # Plaintext version of the body
    body_html: Optional[str]           # HTML version (for URL extraction only — not fed to model)

    # --- Extracted features (safe — no PII) ---
    urls: list[str] = field(default_factory=list)
    domains: list[str] = field(default_factory=list)
    attachment_names: list[str] = field(default_factory=list)
    attachment_hashes: list[str] = field(default_factory=list)  # SHA256, hex-encoded
    crypto_addresses: list[str] = field(default_factory=list)

    # --- Derived signals ---
    urgency_signal_count: int = 0      # Count of urgency phrases found in subject + body
    has_html_only_body: bool = False   # True if no plaintext body — phishing indicator
    has_mismatched_links: bool = False # True if link display text ≠ actual URL domain
    attachment_count: int = 0


class EMLParser:
    """
    Parses a raw .eml file into a ParsedEmail dataclass.

    Usage:
        parser = EMLParser()
        parsed = parser.parse_file(Path("email.eml"))
        # or
        parsed = parser.parse_bytes(eml_bytes)
    """

    def parse_file(self, eml_path: Path) -> ParsedEmail:
        """Parse an .eml file from disk."""
        logger.debug("Parsing EML file: %s", eml_path.name)
        raw = eml_path.read_bytes()
        return self.parse_bytes(raw)

    def parse_bytes(self, raw: bytes) -> ParsedEmail:
        """Parse raw EML bytes into a ParsedEmail."""
        msg: EmailMessage = email.message_from_bytes(raw, policy=policy.default)  # type: ignore

        subject = str(msg.get("Subject", "") or "").strip()
        date = str(msg.get("Date", "") or "").strip() or None

        sender_domain = self._extract_domain(str(msg.get("From", "") or ""))
        reply_to_raw = str(msg.get("Reply-To", "") or "")
        reply_to_domain = self._extract_domain(reply_to_raw) if reply_to_raw else None

        # Auth results
        spf = self._parse_auth_result(msg, "spf")
        dkim = self._parse_auth_result(msg, "dkim")
        dmarc = self._parse_auth_result(msg, "dmarc")
        received_hops = len(msg.get_all("Received") or [])

        # Body extraction
        body_text, body_html = self._extract_body(msg)

        # URLs from body
        urls = self._extract_urls(body_html or body_text)
        domains = list({self._url_to_domain(u) for u in urls if self._url_to_domain(u)})

        # Attachments
        attachment_names, attachment_hashes, attachment_count = self._extract_attachments(msg)

        # Crypto addresses (extracted from plain text body before redaction)
        crypto_addresses = self._extract_crypto_addresses(body_text)

        # Signals
        combined_text = (subject + " " + body_text).lower()
        urgency_count = sum(1 for phrase in _URGENCY_WORDS if phrase in combined_text)
        has_html_only = bool(body_html) and not body_text.strip()
        has_mismatched = self._detect_mismatched_links(body_html) if body_html else False

        parsed = ParsedEmail(
            sender_domain=sender_domain,
            reply_to_domain=reply_to_domain,
            subject=subject,
            date=date,
            spf_result=spf,
            dkim_result=dkim,
            dmarc_result=dmarc,
            received_hops=received_hops,
            body_text=body_text,
            body_html=body_html,
            urls=urls,
            domains=domains,
            attachment_names=attachment_names,
            attachment_hashes=attachment_hashes,
            attachment_count=attachment_count,
            crypto_addresses=crypto_addresses,
            urgency_signal_count=urgency_count,
            has_html_only_body=has_html_only,
            has_mismatched_links=has_mismatched,
        )

        logger.debug(
            "Parsed email: sender_domain=%s spf=%s dkim=%s urls=%d urgency=%d",
            sender_domain, spf, dkim, len(urls), urgency_count
        )
        return parsed

    # --- Private helpers --------------------------------------------------

    def _extract_domain(self, raw: str) -> Optional[str]:
        """Extract domain-only from an email address string. Returns None if not found."""
        match = _RE_EMAIL_DOMAIN.search(raw)
        return match.group(1).lower() if match else None

    def _parse_auth_result(self, msg: EmailMessage, proto: str) -> Optional[str]:
        """
        Parse SPF/DKIM/DMARC result from Authentication-Results header.
        Returns "pass", "fail", "softfail", "neutral", "none", or None.
        """
        auth_header = str(msg.get("Authentication-Results", "") or "")
        if not auth_header:
            return None
        pattern = re.compile(rf'{proto}=(\S+)', re.IGNORECASE)
        match = pattern.search(auth_header)
        if match:
            result = match.group(1).rstrip(';').lower()
            return result
        return None

    def _extract_body(self, msg: EmailMessage) -> tuple[str, Optional[str]]:
        """Extract plaintext and HTML body parts."""
        body_text = ""
        body_html = None

        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                disposition = str(part.get("Content-Disposition") or "")

                if "attachment" in disposition:
                    continue  # handled separately

                if ctype == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_text += payload.decode(charset, errors="replace")

                elif ctype == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        raw_html = payload.decode(charset, errors="replace")
                        body_html = raw_html
                        # Also extract text from HTML if we have no plaintext body
                        if not body_text:
                            soup = BeautifulSoup(raw_html, "lxml")
                            body_text = soup.get_text(separator=" ", strip=True)
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body_text = payload.decode(charset, errors="replace")

        return body_text.strip(), body_html

    def _extract_urls(self, text: str) -> list[str]:
        """Extract all URLs from text or HTML."""
        url_pattern = re.compile(
            r'https?://[^\s\'"<>()]+',
            re.IGNORECASE
        )
        # Also extract href attributes from HTML
        href_pattern = re.compile(r'href=["\']?(https?://[^"\'>\s]+)', re.IGNORECASE)
        found = set(url_pattern.findall(text))
        found |= set(href_pattern.findall(text))
        # Clean up trailing punctuation
        cleaned = {u.rstrip('.,;)') for u in found}
        return sorted(cleaned)

    def _url_to_domain(self, url: str) -> Optional[str]:
        """Extract the domain/hostname from a URL."""
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            return hostname.lower() if hostname else None
        except Exception:
            return None

    def _extract_attachments(self, msg: EmailMessage) -> tuple[list[str], list[str], int]:
        """Extract attachment filenames and SHA256 hashes. Never reads content into memory beyond hash."""
        names: list[str] = []
        hashes: list[str] = []
        count = 0

        for part in msg.walk():
            disposition = str(part.get("Content-Disposition") or "")
            if "attachment" in disposition:
                count += 1
                filename = part.get_filename() or f"attachment_{count}"
                names.append(filename)

                payload = part.get_payload(decode=True)
                if payload:
                    sha256 = hashlib.sha256(payload).hexdigest()
                    hashes.append(sha256)

        return names, hashes, count

    def _extract_crypto_addresses(self, text: str) -> list[str]:
        """
        Extract crypto wallet addresses from body text.
        These are extracted BEFORE redaction so they can be forwarded to
        blockchain reputation services if enabled.
        They are NOT redacted because they are not PII — they are public blockchain identifiers.
        """
        addresses: list[str] = []
        addresses += _RE_ETH.findall(text)
        addresses += _RE_BTC_LEGACY.findall(text)
        addresses += _RE_BTC_BECH32.findall(text)
        # Solana: high false-positive rate, only include if context suggests crypto
        if any(word in text.lower() for word in ["solana", "sol", "phantom", "wallet"]):
            addresses += _RE_SOL.findall(text)
        return list(set(addresses))

    def _detect_mismatched_links(self, html: str) -> bool:
        """
        Detect if any link's display text looks like a URL but points to a different domain.
        A classic phishing technique: <a href="http://evil.ru">http://paypal.com</a>
        """
        try:
            soup = BeautifulSoup(html, "lxml")
            for tag in soup.find_all("a", href=True):
                href = tag["href"]
                display = tag.get_text(strip=True)
                if display.startswith("http"):
                    href_domain = self._url_to_domain(href)
                    display_domain = self._url_to_domain(display)
                    if href_domain and display_domain and href_domain != display_domain:
                        return True
        except Exception:
            pass
        return False
