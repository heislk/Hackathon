"""
email-intelligence/src/virustotal.py

VirusTotal enrichment client for privacy-safe email intelligence.

Only non-PII indicators are ever sent:
  - URL strings extracted from the message body
  - Domain strings extracted from URLs and sender metadata
  - SHA256 hashes of attachments

Raw email content, message bodies, and addresses are never transmitted.
"""

from __future__ import annotations

import asyncio
import base64
import copy
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

VT_API_BASE = "https://www.virustotal.com/api/v3"


@dataclass
class VirusTotalUrlResult:
    url: str
    domain: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_categories: list[str] = field(default_factory=list)
    is_malicious: bool = False
    last_analysis_date: Optional[str] = None
    permalink: str = ""


@dataclass
class VirusTotalDomainResult:
    domain: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_categories: list[str] = field(default_factory=list)
    is_malicious: bool = False
    last_analysis_date: Optional[str] = None
    permalink: str = ""


@dataclass
class VirusTotalHashResult:
    sha256: str
    malicious_votes: int
    suspicious_votes: int
    total_engines: int
    threat_name: Optional[str] = None
    file_type: Optional[str] = None
    threat_categories: list[str] = field(default_factory=list)
    is_malicious: bool = False
    last_analysis_date: Optional[str] = None


@dataclass
class VirusTotalScanSummary:
    configured: bool
    url_results: list[VirusTotalUrlResult] = field(default_factory=list)
    domain_results: list[VirusTotalDomainResult] = field(default_factory=list)
    hash_results: list[VirusTotalHashResult] = field(default_factory=list)
    vt_score: float = 0.0
    any_malicious: bool = False
    all_threat_categories: list[str] = field(default_factory=list)
    checked_items: int = 0


class VirusTotalClient:
    """
    Lightweight async VirusTotal v3 client.

    The client is optional: if no API key is configured, all methods fall back
    to empty summaries and the caller can continue with ML-only scoring.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        enabled: Optional[bool] = None,
        client: Optional[httpx.AsyncClient] = None,
        request_interval_ms: Optional[int] = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        self.api_key = (api_key if api_key is not None else os.getenv("VIRUSTOTAL_API_KEY", "")).strip()
        if enabled is None:
            enabled = os.getenv("ENABLE_VIRUSTOTAL_ENRICHMENT", "true").lower() not in {
                "0",
                "false",
                "no",
                "off",
            }
        self.enabled = bool(self.api_key) and bool(enabled)

        if request_interval_ms is None:
            request_interval_ms = int(os.getenv("VIRUSTOTAL_MIN_REQUEST_INTERVAL_MS", "0"))
        self._min_request_interval = max(0.0, request_interval_ms / 1000.0)
        self._timeout_seconds = timeout_seconds
        self._last_request_at = 0.0
        self._cache: dict[tuple[str, str], object] = {}
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    def is_configured(self) -> bool:
        return self.enabled

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def scan_email_features(
        self,
        urls: list[str],
        hashes: list[str],
        domains: Optional[list[str]] = None,
        max_checks: int = 5,
    ) -> VirusTotalScanSummary:
        if not self.is_configured():
            return self.empty_summary()

        items: list[tuple[str, str]] = []
        items.extend(("url", item) for item in self._unique(urls))
        items.extend(("domain", item) for item in self._unique(domains or []))
        items.extend(("hash", item) for item in self._unique(hashes))

        url_results: list[VirusTotalUrlResult] = []
        domain_results: list[VirusTotalDomainResult] = []
        hash_results: list[VirusTotalHashResult] = []

        for kind, value in items[:max_checks]:
            try:
                if kind == "url":
                    url_results.append(await self.check_url(value))
                elif kind == "domain":
                    domain_results.append(await self.check_domain(value))
                else:
                    hash_results.append(await self.check_hash(value))
            except Exception as exc:
                logger.warning("VirusTotal %s check failed for %s: %s", kind, self._short(value), exc)

        return self.build_summary(url_results, domain_results, hash_results)

    async def check_url(self, url: str) -> VirusTotalUrlResult:
        cache_key = ("url", url)
        cached = self._cache.get(cache_key)
        if isinstance(cached, VirusTotalUrlResult):
            return copy.deepcopy(cached)

        await self._throttle()
        url_id = self._encode_url_id(url)
        response = await self._request("GET", f"/urls/{url_id}")

        if response.status_code == 404:
            result = await self._submit_url_placeholder(url)
            self._cache[cache_key] = result
            return copy.deepcopy(result)

        response.raise_for_status()
        payload = response.json()
        attrs = self._attributes(payload)
        stats = self._stats(attrs)
        result = VirusTotalUrlResult(
            url=url,
            domain=self._hostname(url),
            malicious_votes=stats["malicious"],
            suspicious_votes=stats["suspicious"],
            total_engines=stats["total"],
            threat_categories=self._categories(attrs),
            is_malicious=self._is_url_malicious(stats),
            last_analysis_date=self._analysis_date(attrs),
            permalink=f"https://www.virustotal.com/gui/url/{url_id}",
        )
        self._cache[cache_key] = result
        return copy.deepcopy(result)

    async def check_domain(self, domain: str) -> VirusTotalDomainResult:
        normalized = self._normalize_domain(domain)
        cache_key = ("domain", normalized)
        cached = self._cache.get(cache_key)
        if isinstance(cached, VirusTotalDomainResult):
            return copy.deepcopy(cached)

        await self._throttle()
        response = await self._request("GET", f"/domains/{normalized}")

        if response.status_code == 404:
            result = VirusTotalDomainResult(
                domain=normalized,
                malicious_votes=0,
                suspicious_votes=0,
                total_engines=0,
                threat_categories=[],
                is_malicious=False,
                last_analysis_date=None,
                permalink=f"https://www.virustotal.com/gui/domain/{normalized}",
            )
            self._cache[cache_key] = result
            return copy.deepcopy(result)

        response.raise_for_status()
        payload = response.json()
        attrs = self._attributes(payload)
        stats = self._stats(attrs)
        result = VirusTotalDomainResult(
            domain=normalized,
            malicious_votes=stats["malicious"],
            suspicious_votes=stats["suspicious"],
            total_engines=stats["total"],
            threat_categories=self._categories(attrs),
            is_malicious=self._is_domain_malicious(stats),
            last_analysis_date=self._analysis_date(attrs),
            permalink=f"https://www.virustotal.com/gui/domain/{normalized}",
        )
        self._cache[cache_key] = result
        return copy.deepcopy(result)

    async def check_hash(self, sha256: str) -> VirusTotalHashResult:
        cache_key = ("hash", sha256.lower())
        cached = self._cache.get(cache_key)
        if isinstance(cached, VirusTotalHashResult):
            return copy.deepcopy(cached)

        await self._throttle()
        response = await self._request("GET", f"/files/{sha256}")

        if response.status_code == 404:
            result = VirusTotalHashResult(
                sha256=sha256,
                malicious_votes=0,
                suspicious_votes=0,
                total_engines=0,
                threat_name=None,
                file_type=None,
                threat_categories=[],
                is_malicious=False,
                last_analysis_date=None,
            )
            self._cache[cache_key] = result
            return copy.deepcopy(result)

        response.raise_for_status()
        payload = response.json()
        attrs = self._attributes(payload)
        stats = self._stats(attrs)
        classification = attrs.get("popular_threat_classification") or {}
        threat_name = classification.get("suggested_threat_label")
        if not threat_name and isinstance(classification.get("popular_threat_category"), dict):
            threat_name = classification["popular_threat_category"].get("value")

        result = VirusTotalHashResult(
            sha256=sha256,
            malicious_votes=stats["malicious"],
            suspicious_votes=stats["suspicious"],
            total_engines=stats["total"],
            threat_name=threat_name,
            file_type=attrs.get("type_description"),
            threat_categories=self._categories(attrs),
            is_malicious=self._is_hash_malicious(stats),
            last_analysis_date=self._analysis_date(attrs),
        )
        self._cache[cache_key] = result
        return copy.deepcopy(result)

    def build_summary(
        self,
        url_results: list[VirusTotalUrlResult],
        domain_results: list[VirusTotalDomainResult],
        hash_results: list[VirusTotalHashResult],
    ) -> VirusTotalScanSummary:
        all_results = [*url_results, *domain_results, *hash_results]
        checked_items = len(all_results)
        malicious_items = sum(1 for item in all_results if item.is_malicious)
        vt_score = malicious_items / checked_items if checked_items else 0.0
        categories: list[str] = []
        for item in all_results:
            categories.extend(item.threat_categories)

        return VirusTotalScanSummary(
            configured=True,
            url_results=url_results,
            domain_results=domain_results,
            hash_results=hash_results,
            vt_score=min(1.0, vt_score),
            any_malicious=malicious_items > 0,
            all_threat_categories=sorted(set(categories)),
            checked_items=checked_items,
        )

    def empty_summary(self) -> VirusTotalScanSummary:
        return VirusTotalScanSummary(configured=False)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _request(self, method: str, path: str, data: Optional[dict[str, str]] = None) -> httpx.Response:
        headers = {"x-apikey": self.api_key}
        url = f"{VT_API_BASE}{path}"
        return await self._client.request(method, url, headers=headers, data=data)

    async def _submit_url_placeholder(self, url: str) -> VirusTotalUrlResult:
        try:
            await self._request("POST", "/urls", data={"url": url})
        except Exception as exc:
            logger.debug("VirusTotal URL submission failed for %s: %s", self._short(url), exc)

        result = VirusTotalUrlResult(
            url=url,
            domain=self._hostname(url),
            malicious_votes=0,
            suspicious_votes=0,
            total_engines=0,
            threat_categories=[],
            is_malicious=False,
            last_analysis_date=None,
            permalink=f"https://www.virustotal.com/gui/url/{self._encode_url_id(url)}",
        )
        return result

    async def _throttle(self) -> None:
        if self._min_request_interval <= 0:
            return
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self._min_request_interval:
            await asyncio.sleep(self._min_request_interval - elapsed)
        self._last_request_at = time.monotonic()

    @staticmethod
    def _unique(items: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in items:
            normalized = item.strip()
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(normalized)
        return out

    @staticmethod
    def _encode_url_id(url: str) -> str:
        return base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")

    @staticmethod
    def _normalize_domain(domain: str) -> str:
        return domain.strip().lower().rstrip(".")

    @staticmethod
    def _hostname(url: str) -> str:
        try:
            parsed = urlparse(url)
            return (parsed.hostname or url).lower()
        except Exception:
            return url.lower()

    @staticmethod
    def _short(value: str, length: int = 32) -> str:
        return value if len(value) <= length else f"{value[:length]}..."

    @staticmethod
    def _attributes(payload: dict) -> dict:
        data = payload.get("data") or {}
        attrs = data.get("attributes") or {}
        return attrs if isinstance(attrs, dict) else {}

    @staticmethod
    def _stats(attrs: dict) -> dict[str, int]:
        raw_stats = attrs.get("last_analysis_stats") or {}
        malicious = int(raw_stats.get("malicious") or 0)
        suspicious = int(raw_stats.get("suspicious") or 0)
        total = 0
        for value in raw_stats.values():
            if isinstance(value, (int, float)):
                total += int(value)
        return {
            "malicious": malicious,
            "suspicious": suspicious,
            "total": total,
        }

    @staticmethod
    def _analysis_date(attrs: dict) -> Optional[str]:
        value = attrs.get("last_analysis_date")
        if isinstance(value, (int, float)):
            return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(value))
        return None

    @staticmethod
    def _categories(attrs: dict) -> list[str]:
        categories = attrs.get("categories") or {}
        values: list[str] = []
        if isinstance(categories, dict):
            values.extend(str(v) for v in categories.values() if v)
        elif isinstance(categories, list):
            values.extend(str(v) for v in categories if v)

        classification = attrs.get("popular_threat_classification") or {}
        if isinstance(classification, dict):
            threat_categories = classification.get("popular_threat_category")
            if isinstance(threat_categories, list):
                for item in threat_categories:
                    if isinstance(item, dict):
                        label = item.get("value") or item.get("name")
                        if label:
                            values.append(str(label))

        return sorted(set(values))

    @staticmethod
    def _is_url_malicious(stats: dict[str, int]) -> bool:
        total = stats["total"]
        return total > 0 and (stats["malicious"] / total) > 0.10

    @staticmethod
    def _is_domain_malicious(stats: dict[str, int]) -> bool:
        total = stats["total"]
        return total > 0 and (stats["malicious"] / total) > 0.10

    @staticmethod
    def _is_hash_malicious(stats: dict[str, int]) -> bool:
        total = stats["total"]
        return total > 0 and (stats["malicious"] / total) > 0.05

