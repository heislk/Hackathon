from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image, ImageOps


@dataclass
class OCRResult:
    text: str
    backend: str
    confidence: Optional[float] = None
    line_count: int = 0


class OCRExtractor:
    def __init__(self) -> None:
        self._backend: str | None = None
        self._easyocr_reader = None

    def backend_name(self) -> str:
        if self._backend is None:
            self._detect_backend()
        return self._backend or "unavailable"

    def _detect_backend(self) -> None:
        if self._backend is not None:
            return

        for backend in self._available_backends():
            self._backend = backend
            return

        self._backend = None

    @staticmethod
    def _available_backends() -> list[str]:
        backends: list[str] = []

        try:
            import pytesseract  # noqa: F401

            backends.append("pytesseract")
        except Exception:
            pass

        try:
            import easyocr  # noqa: F401

            backends.append("easyocr")
        except Exception:
            pass

        try:
            import rapidocr_onnxruntime  # noqa: F401

            backends.append("rapidocr_onnxruntime")
        except Exception:
            pass

        return backends

    def available(self) -> bool:
        return len(self._available_backends()) > 0

    def extract(self, image_bytes: bytes) -> OCRResult:
        backends = self._available_backends()
        if not backends:
            raise RuntimeError(
                "No OCR backend is installed. Add pytesseract, easyocr, or rapidocr-onnxruntime."
            )

        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")

        errors: list[str] = []
        for backend in backends:
            try:
                self._backend = backend
                if backend == "pytesseract":
                    return self._extract_with_pytesseract(image)
                if backend == "easyocr":
                    return self._extract_with_easyocr(image)
                if backend == "rapidocr_onnxruntime":
                    return self._extract_with_rapidocr(image)
            except Exception as exc:
                errors.append(f"{backend}: {exc}")

        raise RuntimeError("All OCR backends failed. " + " | ".join(errors))

    @staticmethod
    def _normalize_text(text: str) -> str:
        return "\n".join(line.strip() for line in text.splitlines() if line.strip()).strip()

    def _extract_with_pytesseract(self, image: Image.Image) -> OCRResult:
        import pytesseract

        text = pytesseract.image_to_string(image, config="--psm 6")
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = []
        for conf in data.get("conf", []):
            try:
                value = float(conf)
            except Exception:
                continue
            if value >= 0:
                confidences.append(value)
        confidence = round(sum(confidences) / len(confidences), 2) if confidences else None
        normalized = self._normalize_text(text)
        return OCRResult(
            text=normalized,
            backend="pytesseract",
            confidence=confidence,
            line_count=len(normalized.splitlines()) if normalized else 0,
        )

    def _extract_with_easyocr(self, image: Image.Image) -> OCRResult:
        import easyocr

        if self._easyocr_reader is None:
            self._easyocr_reader = easyocr.Reader(["en"], gpu=False)

        results = self._easyocr_reader.readtext(np.array(image))
        lines = [item[1] for item in results if len(item) >= 2 and item[1]]
        confidences = []
        for item in results:
            if len(item) >= 3:
                try:
                    confidences.append(float(item[2]))
                except Exception:
                    pass
        normalized = self._normalize_text("\n".join(lines))
        confidence = round(sum(confidences) / len(confidences), 2) if confidences else None
        return OCRResult(
            text=normalized,
            backend="easyocr",
            confidence=confidence,
            line_count=len(lines),
        )

    def _extract_with_rapidocr(self, image: Image.Image) -> OCRResult:
        from rapidocr_onnxruntime import RapidOCR

        ocr = RapidOCR()
        result = ocr(np.array(image))
        lines = []
        confidences = []

        if isinstance(result, tuple):
            items = result[0] or []
        else:
            items = result or []

        for item in items:
            if not item:
                continue
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                text = str(item[1])
                if text:
                    lines.append(text)
                if len(item) >= 3:
                    try:
                        confidences.append(float(item[2]))
                    except Exception:
                        pass

        normalized = self._normalize_text("\n".join(lines))
        confidence = round(sum(confidences) / len(confidences), 2) if confidences else None
        return OCRResult(
            text=normalized,
            backend="rapidocr_onnxruntime",
            confidence=confidence,
            line_count=len(lines),
        )
