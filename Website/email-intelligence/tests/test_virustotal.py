import asyncio
import base64

import httpx

from src.virustotal import VirusTotalClient


def test_encode_url_id_uses_base64url_without_padding():
    async def run() -> None:
        async with httpx.AsyncClient() as http_client:
            client = VirusTotalClient(api_key="test-key", enabled=True, client=http_client)
            url = "https://example.com/login?next=/wallet"
            encoded = client._encode_url_id(url)
            expected = base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")
            assert encoded == expected

    asyncio.run(run())


def test_scan_email_features_parses_url_domain_and_hash_results():
    async def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path

        if path.startswith("/api/v3/urls/") and request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "attributes": {
                            "last_analysis_stats": {
                                "malicious": 2,
                                "suspicious": 1,
                                "harmless": 7,
                            },
                            "last_analysis_date": 1711111111,
                            "categories": {"engine-a": "phishing"},
                        }
                    }
                },
            )

        if path == "/api/v3/domains/example.com" and request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "attributes": {
                            "last_analysis_stats": {
                                "malicious": 0,
                                "suspicious": 0,
                                "harmless": 10,
                            },
                            "last_analysis_date": 1712222222,
                        }
                    }
                },
            )

        if path == "/api/v3/files/abcd" and request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "attributes": {
                            "last_analysis_stats": {
                                "malicious": 5,
                                "suspicious": 0,
                                "harmless": 55,
                            },
                            "popular_threat_classification": {
                                "suggested_threat_label": "Trojan.Generic"
                            },
                            "type_description": "PDF",
                            "last_analysis_date": 1713333333,
                        }
                    }
                },
            )

        raise AssertionError(f"Unexpected request: {request.method} {path}")

    transport = httpx.MockTransport(handler)

    async def run() -> None:
        async with httpx.AsyncClient(transport=transport) as http_client:
            client = VirusTotalClient(
                api_key="test-key",
                enabled=True,
                client=http_client,
                request_interval_ms=0,
            )

            summary = await client.scan_email_features(
                urls=["https://example.com/login"],
                hashes=["abcd"],
                domains=["example.com"],
                max_checks=5,
            )

            assert summary.configured is True
            assert summary.checked_items == 3
            assert summary.any_malicious is True
            assert summary.vt_score == 2 / 3
            assert summary.all_threat_categories == ["phishing"]

            assert len(summary.url_results) == 1
            assert summary.url_results[0].domain == "example.com"
            assert summary.url_results[0].is_malicious is True

            assert len(summary.domain_results) == 1
            assert summary.domain_results[0].domain == "example.com"
            assert summary.domain_results[0].is_malicious is False

            assert len(summary.hash_results) == 1
            assert summary.hash_results[0].threat_name == "Trojan.Generic"
            assert summary.hash_results[0].is_malicious is True

    asyncio.run(run())


def test_scan_email_features_returns_empty_summary_when_disabled():
    async def run() -> None:
        async with httpx.AsyncClient() as http_client:
            client = VirusTotalClient(api_key="", enabled=True, client=http_client)
            summary = await client.scan_email_features(["https://example.com"], ["abcd"], ["example.com"])
            assert summary.configured is False
            assert summary.checked_items == 0
            assert summary.vt_score == 0.0

    asyncio.run(run())
