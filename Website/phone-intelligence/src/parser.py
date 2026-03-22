from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import phonenumbers

from .ocr import OCRResult

_URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
_SHORTENER_HOSTS = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "rebrand.ly",
    "rb.gy",
    "cutt.ly",
}
_URGENCY_PATTERNS = [
    "urgent",
    "verify",
    "confirm",
    "locked",
    "suspended",
    "action required",
    "immediately",
    "package",
    "delivery",
    "refund",
    "payment",
    "invoice",
    "security alert",
    "otp",
    "one-time code",
    "code:",
    "appeal",
    "update now",
    "claim",
    "gift",
    "crypto",
    "wallet",
]


@dataclass
class ParsedPhoneMessage:
    source_kind: str
    raw_text: str
    message_text: str
    sender_number: str | None
    detected_phone_numbers: list[str] = field(default_factory=list)
    urls: list[str] = field(default_factory=list)
    domains: list[str] = field(default_factory=list)
    shortener_urls: list[str] = field(default_factory=list)
    urgency_signal_count: int = 0
    keyword_hits: list[str] = field(default_factory=list)
    money_mentions: list[str] = field(default_factory=list)
    line_count: int = 0
    character_count: int = 0
    ocr_backend: str | None = None
    ocr_confidence: float | None = None
    ocr_line_count: int = 0


class PhoneMessageParser:
    def __init__(self, default_region: str = "US") -> None:
        self.default_region = default_region

    def parse(
        self,
        text: str,
        sender_number: str | None = None,
        source_kind: str = "text",
        ocr_result: OCRResult | None = None,
    ) -> ParsedPhoneMessage:
        raw_text = text or ""
        normalized = self._normalize(raw_text)
        urls = self._extract_urls(normalized)
        domains = self._extract_domains(urls)
        shortener_urls = [url for url in urls if self._is_shortener(url)]
        phone_candidates = self._extract_phone_numbers(normalized)
        urgency_signal_count, keyword_hits = self._extract_keyword_signals(normalized)
        money_mentions = re.findall(r"[$€£]\s?\d+(?:[.,]\d+)?(?:k|m)?", normalized, flags=re.IGNORECASE)

        return ParsedPhoneMessage(
            source_kind=source_kind,
            raw_text=raw_text,
            message_text=normalized,
            sender_number=sender_number.strip() if sender_number else None,
            detected_phone_numbers=phone_candidates,
            urls=urls,
            domains=domains,
            shortener_urls=shortener_urls,
            urgency_signal_count=urgency_signal_count,
            keyword_hits=keyword_hits,
            money_mentions=money_mentions,
            line_count=len(normalized.splitlines()) if normalized else 0,
            character_count=len(normalized),
            ocr_backend=ocr_result.backend if ocr_result else None,
            ocr_confidence=ocr_result.confidence if ocr_result else None,
            ocr_line_count=ocr_result.line_count if ocr_result else 0,
        )

    def _normalize(self, text: str) -> str:
        lines = [line.strip() for line in (text or "").replace("\r\n", "\n").split("\n")]
        cleaned = "\n".join(line for line in lines if line)
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        return cleaned.strip()

    def _extract_urls(self, text: str) -> list[str]:
        return list(dict.fromkeys(_URL_RE.findall(text)))

    def _extract_domains(self, urls: list[str]) -> list[str]:
        domains: list[str] = []
        for url in urls:
            try:
                hostname = urlparse(url).hostname
                if hostname:
                    domains.append(hostname.lower().removeprefix("www."))
            except Exception:
                continue
        return list(dict.fromkeys(domains))

    def _extract_phone_numbers(self, text: str) -> list[str]:
        found: list[str] = []
        try:
            for match in phonenumbers.PhoneNumberMatcher(text, self.default_region):
                number = phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.E164)
                found.append(number)
        except Exception:
            pass
        return list(dict.fromkeys(found))

    def _extract_keyword_signals(self, text: str) -> tuple[int, list[str]]:
        lower = text.lower()
        hits = [pattern for pattern in _URGENCY_PATTERNS if pattern in lower]
        return len(hits), hits

    def _is_shortener(self, url: str) -> bool:
        try:
            hostname = urlparse(url).hostname or ""
            return hostname.lower().removeprefix("www.") in _SHORTENER_HOSTS
        except Exception:
            return False
