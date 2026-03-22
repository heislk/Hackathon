from __future__ import annotations

import json
import logging
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .parser import ParsedPhoneMessage
from .phone_enrichment import PhoneEnrichment

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_MODEL_DIR = _REPO_ROOT / os.getenv("MODEL_DIR", "data/phone-intelligence/model")
_MAX_LENGTH = int(os.getenv("MAX_TOKEN_LENGTH", "128"))
BASE_MODEL_NAME = "distilbert-base-uncased"

_TIER_THRESHOLDS = [
    (0.90, "CRITICAL"),
    (0.75, "HIGH"),
    (0.50, "MEDIUM"),
    (0.25, "LOW"),
    (0.00, "CLEAN"),
]


@dataclass
class SmishingScore:
    probability: float
    risk_tier: str
    top_tokens: list[str]
    model_version: str
    is_smishing: bool
    confidence: str
    model_probability: float
    heuristic_probability: float
    model_available: bool


class SmishingClassifier:
    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self._model_dir = self._resolve_model_dir(model_dir)
        self._model = None
        self._tokenizer = None
        self._sk_model = None
        self._metadata = None
        self._device = self._detect_device()
        self._model_version = "distilbert-smishing-v1"
        self._model_kind = "heuristic"

    @staticmethod
    def _resolve_model_dir(model_dir: Optional[Path]) -> Path:
        if model_dir is None:
            return _DEFAULT_MODEL_DIR
        model_dir = Path(model_dir)
        return model_dir if model_dir.is_absolute() else (_REPO_ROOT / model_dir)

    @staticmethod
    def _detect_device():
        try:
            import torch
        except Exception:
            return "cpu"

        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def is_model_available(self) -> bool:
        return self._sk_model_available() or self._hf_model_available()

    def model_version(self) -> str:
        if self.is_model_available():
            try:
                self._load()
            except Exception:
                return self._model_version
        return self._model_version

    def model_kind(self) -> str:
        if self.is_model_available():
            try:
                self._load()
            except Exception:
                return self._model_kind
        return self._model_kind

    def _hf_model_available(self) -> bool:
        required = [
            self._model_dir / "config.json",
            self._model_dir / "tokenizer_config.json",
        ]
        weight_files = [
            self._model_dir / "model.safetensors",
            self._model_dir / "pytorch_model.bin",
        ]
        return self._model_dir.is_dir() and all(f.exists() for f in required) and any(
            f.exists() for f in weight_files
        )

    def _sk_model_available(self) -> bool:
        return (self._model_dir / "phone_classifier.joblib").exists()

    def _load(self) -> None:
        if self._model is not None or self._sk_model is not None:
            return
        if not self.is_model_available():
            raise RuntimeError(
                f"No trained model found at '{self._model_dir}'. Run training first or keep the heuristic fallback."
            )

        if self._sk_model_available():
            import joblib

            scripts_dir = _REPO_ROOT / "scripts"
            if scripts_dir.is_dir():
                sys.path.insert(0, str(scripts_dir))
            self._sk_model = joblib.load(self._model_dir / "phone_classifier.joblib")
            metadata_path = self._model_dir / "metadata.json"
            if metadata_path.exists():
                self._metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                self._model_version = str(self._metadata.get("model_version") or "sklearn-smishing-v1")
            else:
                self._metadata = {}
                self._model_version = "sklearn-smishing-v1"
            self._model_kind = "sklearn"
            return

        if not self._hf_model_available():
            raise RuntimeError(f"No supported trained model found at '{self._model_dir}'.")

        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self._tokenizer = AutoTokenizer.from_pretrained(str(self._model_dir))
        self._model = AutoModelForSequenceClassification.from_pretrained(
            str(self._model_dir),
            output_attentions=True,
        )
        self._model.to(self._device)
        self._model.eval()
        self._model_kind = "transformer"

    def score(
        self,
        parsed: ParsedPhoneMessage,
        redacted_text: str,
        enrichment: PhoneEnrichment,
    ) -> SmishingScore:
        model_probability = self._score_with_model(parsed, redacted_text, enrichment)
        heuristic_probability = self._heuristic_score(parsed, enrichment, redacted_text)
        final_probability = min(0.99, max(model_probability, heuristic_probability))
        risk_tier = self._score_to_tier(final_probability)
        confidence = "HIGH" if final_probability < 0.25 or final_probability > 0.75 else "MEDIUM"
        top_tokens = self._extract_top_tokens(parsed, redacted_text, enrichment)

        return SmishingScore(
            probability=round(final_probability, 4),
            risk_tier=risk_tier,
            top_tokens=top_tokens,
            model_version=self._model_version,
            is_smishing=final_probability >= 0.50,
            confidence=confidence,
            model_probability=round(model_probability, 4),
            heuristic_probability=round(heuristic_probability, 4),
            model_available=self.is_model_available(),
        )

    def _score_with_model(
        self,
        parsed: ParsedPhoneMessage,
        redacted_text: str,
        enrichment: PhoneEnrichment,
    ) -> float:
        if not self.is_model_available():
            return self._heuristic_score(parsed, enrichment, redacted_text)

        self._load()

        if self._sk_model is not None:
            probabilities = self._sk_model.predict_proba(
                [
                    {
                        "text": redacted_text,
                        "sender": enrichment.raw_input,
                        "sender_number": enrichment.raw_input,
                        "message": parsed.message_text,
                    }
                ]
            )
            return float(probabilities[0][1])

        meta = self._build_meta_text(parsed, enrichment)
        model_input = f"{meta}\n\nMessage:\n{redacted_text}".strip()
        import torch

        inputs = self._tokenizer(  # type: ignore[operator]
            model_input,
            return_tensors="pt",
            truncation=True,
            max_length=_MAX_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)  # type: ignore[misc]

        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)
        return float(probs[0][1].item())

    def _heuristic_score(
        self,
        parsed: ParsedPhoneMessage,
        enrichment: PhoneEnrichment,
        redacted_text: str,
    ) -> float:
        score = 0.06
        text = redacted_text.lower()
        trigger_count = 0

        if parsed.urgency_signal_count:
            score += min(0.20, parsed.urgency_signal_count * 0.05)
            trigger_count += 1
        if parsed.urls:
            score += min(0.18, 0.08 + (len(parsed.urls) * 0.04))
            trigger_count += 1
        if parsed.shortener_urls:
            score += 0.10
            trigger_count += 1
        if parsed.money_mentions:
            score += min(0.08, len(parsed.money_mentions) * 0.03)
        if any(token in text for token in ("otp", "one-time", "verification code", "security code")):
            score += 0.12
            trigger_count += 1
        if any(token in text for token in ("gift card", "wire transfer", "refund", "package", "delivery")):
            score += 0.10
            trigger_count += 1
        if any(token in text for token in ("login", "sign in", "password", "account locked", "account suspended")):
            score += 0.10
            trigger_count += 1
        if any(token in text for token in ("crypto", "wallet", "seed phrase", "airdrop", "claim")):
            score += 0.08
            trigger_count += 1

        if trigger_count >= 3:
            score += 0.08
        if parsed.shortener_urls and any(token in text for token in ("verify", "confirm", "login", "sign in", "password", "account")):
            score += 0.08
        if parsed.urls and parsed.urgency_signal_count and any(token in text for token in ("account", "wallet", "payment", "delivery")):
            score += 0.08

        if not enrichment.possible:
            score += 0.10
        if not enrichment.valid:
            score += 0.12
        if enrichment.is_voip:
            score += 0.12
        if enrichment.is_premium_rate:
            score += 0.08
        if enrichment.is_toll_free:
            score += 0.03
        if enrichment.parse_error:
            score += 0.05

        if parsed.source_kind == "image":
            score += 0.03

        return max(0.01, min(0.99, score))

    def _build_meta_text(self, parsed: ParsedPhoneMessage, enrichment: PhoneEnrichment) -> str:
        return (
            f"Source: {parsed.source_kind}\n"
            f"Valid number: {str(enrichment.valid).lower()}\n"
            f"Possible number: {str(enrichment.possible).lower()}\n"
            f"Region: {enrichment.region_code or 'unknown'}\n"
            f"Country code: {enrichment.country_code or 'unknown'}\n"
            f"Number type: {enrichment.number_type}\n"
            f"Carrier: {enrichment.carrier or 'unknown'}\n"
            f"Location: {enrichment.location or 'unknown'}\n"
            f"Urls: {len(parsed.urls)}\n"
            f"Shorteners: {len(parsed.shortener_urls)}\n"
            f"Urgency hits: {parsed.urgency_signal_count}\n"
            f"Keyword hits: {', '.join(parsed.keyword_hits) if parsed.keyword_hits else 'none'}"
        )

    def _extract_top_tokens(self, parsed: ParsedPhoneMessage, redacted_text: str, enrichment: PhoneEnrichment) -> list[str]:
        if not self.is_model_available():
            return self._heuristic_tokens(parsed, enrichment, redacted_text)

        try:
            self._load()
            if self._model_kind == "sklearn":
                return self._heuristic_tokens(parsed, enrichment, redacted_text)

            meta = self._build_meta_text(parsed, enrichment)
            model_input = f"{meta}\n\nMessage:\n{redacted_text}".strip()
            import torch

            inputs = self._tokenizer(  # type: ignore[operator]
                model_input,
                return_tensors="pt",
                truncation=True,
                max_length=_MAX_LENGTH,
                padding=True,
            )
            input_ids = inputs["input_ids"][0]
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = self._model(**inputs, output_attentions=True)  # type: ignore[misc]
            attentions = outputs.attentions
            if not attentions:
                return self._heuristic_tokens(parsed, enrichment, redacted_text)

            last_attn = attentions[-1]
            cls_attn = last_attn[0].mean(dim=0)[0]
            tokens = self._tokenizer.convert_ids_to_tokens(input_ids.tolist())  # type: ignore[operator]
            pairs = list(zip(tokens, cls_attn.tolist()))
            skip = {"[CLS]", "[SEP]", "[PAD]", "[UNK]"}
            filtered = [
                (tok, score)
                for tok, score in pairs
                if tok not in skip and not tok.startswith("##")
            ]
            filtered.sort(key=lambda x: x[1], reverse=True)
            seen: set[str] = set()
            top: list[str] = []
            for tok, _ in filtered:
                if tok not in seen:
                    seen.add(tok)
                    top.append(tok)
                if len(top) >= 5:
                    break
            return top or self._heuristic_tokens(parsed, enrichment, redacted_text)
        except Exception:
            return self._heuristic_tokens(parsed, enrichment, redacted_text)

    def _heuristic_tokens(
        self,
        parsed: ParsedPhoneMessage,
        enrichment: PhoneEnrichment,
        redacted_text: str,
    ) -> list[str]:
        tokens: list[str] = []
        if parsed.keyword_hits:
            tokens.extend(parsed.keyword_hits[:3])
        if parsed.shortener_urls:
            tokens.append("shortener")
        if parsed.urls:
            tokens.append("url")
        if parsed.urgency_signal_count:
            tokens.append("urgency")
        if not enrichment.valid:
            tokens.append("invalid_number")
        if enrichment.is_voip:
            tokens.append("voip")
        if not tokens:
            for word in re.findall(r"[a-z0-9]{3,}", redacted_text.lower()):
                if word not in {"message", "reply", "phone", "number"}:
                    tokens.append(word)
                if len(tokens) >= 5:
                    break
        return list(dict.fromkeys(tokens))[:5]

    @staticmethod
    def _score_to_tier(prob: float) -> str:
        for threshold, tier in _TIER_THRESHOLDS:
            if prob >= threshold:
                return tier
        return "CLEAN"
