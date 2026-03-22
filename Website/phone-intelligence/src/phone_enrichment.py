from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

import phonenumbers
from phonenumbers import carrier, geocoder, timezone
from phonenumbers.phonenumberutil import PhoneNumberType


_NUMBER_TYPE_NAMES = {
    PhoneNumberType.FIXED_LINE: "fixed_line",
    PhoneNumberType.MOBILE: "mobile",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
    PhoneNumberType.TOLL_FREE: "toll_free",
    PhoneNumberType.PREMIUM_RATE: "premium_rate",
    PhoneNumberType.SHARED_COST: "shared_cost",
    PhoneNumberType.VOIP: "voip",
    PhoneNumberType.PERSONAL_NUMBER: "personal_number",
    PhoneNumberType.PAGER: "pager",
    PhoneNumberType.UAN: "uan",
    PhoneNumberType.VOICEMAIL: "voicemail",
    PhoneNumberType.UNKNOWN: "unknown",
}


@dataclass
class PhoneEnrichment:
    raw_input: str
    region_hint: str
    normalized_e164: Optional[str]
    formatted_national: Optional[str]
    formatted_international: Optional[str]
    formatted_rfc3966: Optional[str]
    country_code: Optional[int]
    national_number: Optional[int]
    region_code: Optional[str]
    number_type: str
    carrier: Optional[str]
    location: Optional[str]
    time_zones: list[str]
    possible: bool
    valid: bool
    is_voip: bool
    is_toll_free: bool
    is_premium_rate: bool
    parse_error: Optional[str] = None
    risk_notes: list[str] = None  # type: ignore[assignment]

    def to_dict(self) -> dict:
        payload = asdict(self)
        if payload.get("risk_notes") is None:
            payload["risk_notes"] = []
        return payload


class PhoneEnricher:
    def enrich(self, raw_number: str | None, default_region: str = "US") -> PhoneEnrichment:
        raw = (raw_number or "").strip()
        if not raw:
            return PhoneEnrichment(
                raw_input="",
                region_hint=default_region,
                normalized_e164=None,
                formatted_national=None,
                formatted_international=None,
                formatted_rfc3966=None,
                country_code=None,
                national_number=None,
                region_code=None,
                number_type="unknown",
                carrier=None,
                location=None,
                time_zones=[],
                possible=False,
                valid=False,
                is_voip=False,
                is_toll_free=False,
                is_premium_rate=False,
                parse_error="No phone number supplied",
                risk_notes=["no number supplied"],
            )

        try:
            parsed = phonenumbers.parse(raw, default_region)
            possible = phonenumbers.is_possible_number(parsed)
            valid = phonenumbers.is_valid_number(parsed)
            number_type = _NUMBER_TYPE_NAMES.get(phonenumbers.number_type(parsed), "unknown")
            region_code = phonenumbers.region_code_for_number(parsed)
            normalized_e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            formatted_national = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)
            formatted_international = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            formatted_rfc3966 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.RFC3966)
            carrier_name = carrier.name_for_number(parsed, "en") or None
            location = geocoder.description_for_number(parsed, "en") or None
            time_zones = list(timezone.time_zones_for_number(parsed))

            is_voip = number_type == "voip"
            is_toll_free = number_type == "toll_free"
            is_premium_rate = number_type == "premium_rate"
            risk_notes = []
            if not possible:
                risk_notes.append("number is not a possible numbering-plan match")
            if not valid:
                risk_notes.append("number is not a valid assigned number")
            if is_voip:
                risk_notes.append("voip number often used in scams")
            if is_toll_free:
                risk_notes.append("toll-free numbers can still be abused for impersonation")
            if is_premium_rate:
                risk_notes.append("premium-rate number can be associated with abuse")

            return PhoneEnrichment(
                raw_input=raw,
                region_hint=default_region,
                normalized_e164=normalized_e164,
                formatted_national=formatted_national,
                formatted_international=formatted_international,
                formatted_rfc3966=formatted_rfc3966,
                country_code=parsed.country_code,
                national_number=parsed.national_number,
                region_code=region_code,
                number_type=number_type,
                carrier=carrier_name,
                location=location,
                time_zones=time_zones,
                possible=possible,
                valid=valid,
                is_voip=is_voip,
                is_toll_free=is_toll_free,
                is_premium_rate=is_premium_rate,
                risk_notes=risk_notes,
            )
        except Exception as exc:
            return PhoneEnrichment(
                raw_input=raw,
                region_hint=default_region,
                normalized_e164=None,
                formatted_national=None,
                formatted_international=None,
                formatted_rfc3966=None,
                country_code=None,
                national_number=None,
                region_code=None,
                number_type="unknown",
                carrier=None,
                location=None,
                time_zones=[],
                possible=False,
                valid=False,
                is_voip=False,
                is_toll_free=False,
                is_premium_rate=False,
                parse_error=str(exc),
                risk_notes=["failed to parse number"],
            )
