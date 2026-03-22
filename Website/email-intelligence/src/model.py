"""
email-intelligence/src/model.py

DistilBERT Inference Engine — loads the fine-tuned phishing classifier and
scores redacted email text.

MODEL: distilbert-base-uncased (fine-tuned on Phishing Pot + SpamAssassin ham)
  - 66M parameters (~265 MB on disk)
  - Single-label binary classifier: 0 = legitimate, 1 = phishing
  - Input: redacted plaintext email (subject + body, up to 512 tokens)
  - Output: phishing probability (0.0–1.0) + top attention tokens + risk tier

PRIVACY GUARANTEE:
  This module only ever receives text that has already been processed by
  redactor.py. It never sees raw PII. The model weights are loaded from
  the local filesystem at MODEL_DIR — no network call is made during inference.

RISK TIERS:
  CLEAN    score < 0.25
  LOW      0.25 ≤ score < 0.50
  MEDIUM   0.50 ≤ score < 0.75
  HIGH     0.75 ≤ score < 0.90
  CRITICAL score ≥ 0.90
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_MODEL_DIR = _REPO_ROOT / os.getenv("MODEL_DIR", "model")
_MAX_LENGTH = int(os.getenv("MAX_TOKEN_LENGTH", "128"))

# Base model to use for tokenizer during both training and inference
BASE_MODEL_NAME = "distilbert-base-uncased"

# Score thresholds for risk tiers
_TIER_THRESHOLDS = [
    (0.90, "CRITICAL"),
    (0.75, "HIGH"),
    (0.50, "MEDIUM"),
    (0.25, "LOW"),
    (0.00, "CLEAN"),
]


@dataclass
class PhishingScore:
    """
    Result of running the DistilBERT phishing classifier on an email.

    Attributes:
        probability:    Phishing probability (0.0 = definitely legitimate, 1.0 = definitely phishing)
        risk_tier:      Human-readable tier: CLEAN / LOW / MEDIUM / HIGH / CRITICAL
        top_tokens:     Up to 5 tokens that had the highest attention weights (explains the decision)
        model_version:  Identifier of the model that produced this score
        is_phishing:    True if probability ≥ 0.50 (default decision threshold)
        confidence:     "HIGH" if score < 0.25 or score > 0.75, "MEDIUM" otherwise
    """
    probability: float
    risk_tier: str
    top_tokens: list[str]
    model_version: str
    is_phishing: bool
    confidence: str


class PhishingClassifier:
    """
    Wraps the fine-tuned DistilBERT model for inference.

    The model is loaded lazily on first call to `score()` and cached in memory.
    Model weights are never downloaded during inference — they must already exist
    at `model_dir` (written during the training step).

    Usage:
        classifier = PhishingClassifier()
        score = classifier.score("Dear user, your account has been suspended...")
        print(score.risk_tier)   # e.g. "HIGH"
        print(score.probability) # e.g. 0.87
    """

    def __init__(self, model_dir: Optional[Path] = None):
        self._model_dir = self._resolve_model_dir(model_dir)
        self._model = None
        self._tokenizer = None
        self._device = self._detect_device()
        self._model_version = "distilbert-phishing-v1"

    def is_model_available(self) -> bool:
        """Check whether the trained model exists on disk."""
        required = [
            self._model_dir / "config.json",
            self._model_dir / "tokenizer_config.json",
        ]
        weight_files = [
            self._model_dir / "model.safetensors",
            self._model_dir / "pytorch_model.bin",
        ]
        return (
            self._model_dir.is_dir()
            and all(f.exists() for f in required)
            and any(f.exists() for f in weight_files)
        )

    @staticmethod
    def _resolve_model_dir(model_dir: Optional[Path]) -> Path:
        if model_dir is None:
            return _DEFAULT_MODEL_DIR
        model_dir = Path(model_dir)
        return model_dir if model_dir.is_absolute() else (_REPO_ROOT / model_dir)

    @staticmethod
    def _detect_device() -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def _load(self):
        """Lazy-load model and tokenizer from disk (only once per process)."""
        if self._model is not None:
            return

        if not self.is_model_available():
            raise RuntimeError(
                f"No trained model found at '{self._model_dir}'. "
                f"Run 'python scripts/train.py' first to fine-tune the model."
            )

        from transformers import DistilBertForSequenceClassification, DistilBertTokenizerFast

        logger.info("Loading DistilBERT phishing classifier from %s", self._model_dir)
        self._tokenizer = DistilBertTokenizerFast.from_pretrained(str(self._model_dir))
        self._model = DistilBertForSequenceClassification.from_pretrained(
            str(self._model_dir),
            output_attentions=True,  # needed for top-token extraction
        )
        self._model.to(self._device)
        self._model.eval()
        logger.info("Model loaded. Device: %s", self._device.type)

    def score(self, redacted_text: str) -> PhishingScore:
        """
        Score redacted email text for phishing probability.

        Args:
            redacted_text: Email text that has already been processed by PIIRedactor.
                           MUST NOT contain raw PII — caller is responsible for redaction.

        Returns:
            PhishingScore with probability, risk tier, top attention tokens, and metadata.

        Raises:
            RuntimeError: If model has not been trained yet (model directory missing).
        """
        self._load()

        # Tokenize input
        inputs = self._tokenizer(  # type: ignore
            redacted_text,
            return_tensors="pt",
            truncation=True,
            max_length=_MAX_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)  # type: ignore

        # Get phishing probability (class 1)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)
        phishing_prob = float(probs[0][1].item())

        # Extract top attention tokens from last attention layer
        top_tokens = self._extract_top_tokens(
            inputs["input_ids"][0],
            outputs.attentions,
            n=5
        )

        risk_tier = self._score_to_tier(phishing_prob)
        confidence = "HIGH" if phishing_prob < 0.25 or phishing_prob > 0.75 else "MEDIUM"

        return PhishingScore(
            probability=round(phishing_prob, 4),
            risk_tier=risk_tier,
            top_tokens=top_tokens,
            model_version=self._model_version,
            is_phishing=phishing_prob >= 0.50,
            confidence=confidence,
        )

    @staticmethod
    def _score_to_tier(prob: float) -> str:
        """Map a probability score to a human-readable risk tier."""
        for threshold, tier in _TIER_THRESHOLDS:
            if prob >= threshold:
                return tier
        return "CLEAN"

    def _extract_top_tokens(
        self,
        input_ids: torch.Tensor,
        attentions: tuple,
        n: int = 5,
    ) -> list[str]:
        """
        Extract the top-N tokens with highest average attention weight across all heads
        in the final attention layer. These tokens explain which parts of the text
        most strongly influenced the phishing/legitimate classification.

        Skip [CLS], [SEP], [PAD], subword prefix "##" tokens in the output.
        """
        try:
            # Use the last attention layer, average over all heads
            last_attn = attentions[-1]  # (batch, heads, seq_len, seq_len)
            # Mean over heads, then take attention FROM the [CLS] token (index 0)
            cls_attn = last_attn[0].mean(dim=0)[0]  # (seq_len,)
            token_ids_list = input_ids.tolist()
            tokens = self._tokenizer.convert_ids_to_tokens(token_ids_list)  # type: ignore

            # Pair tokens with their attention scores
            pairs = list(zip(tokens, cls_attn.tolist()))

            # Filter out special tokens
            skip = {"[CLS]", "[SEP]", "[PAD]", "[UNK]"}
            filtered = [
                (tok, score) for tok, score in pairs
                if tok not in skip and not tok.startswith("##")
            ]

            # Sort by attention descending, take top N, deduplicate
            filtered.sort(key=lambda x: x[1], reverse=True)
            seen: set[str] = set()
            top: list[str] = []
            for tok, _ in filtered:
                if tok not in seen:
                    seen.add(tok)
                    top.append(tok)
                if len(top) >= n:
                    break
            return top
        except Exception:
            return []
