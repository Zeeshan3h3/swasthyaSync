"""
MediKiosk — OCR Pipeline (Architecture v2, §7)

Confidence-gated cascade for document digitization:
  1. Quick printed-text pass (Tesseract) — fast, cheap
  2. If confidence < threshold → flag for manual verification
  3. NER extraction from OCR text via LLM

For the hackathon, handwriting OCR is stubbed.
"""

from __future__ import annotations
import io
import logging
import base64

logger = logging.getLogger(__name__)

# Try to import Tesseract
try:
    import pytesseract
    from PIL import Image
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False
    logger.warning("pytesseract or Pillow not installed — OCR will use mock data")

import llm_client

# Confidence threshold for the cascade (§7)
CONFIDENCE_THRESHOLD = 60  # Tesseract confidence percentage


def process_document(image_bytes: bytes, filename: str = "document.jpg") -> dict:
    """
    Process an uploaded document image through the confidence-gated cascade.

    Returns:
    {
        "doc_id": str,
        "ocr_text": str,
        "ocr_confidence": float,
        "ocr_path": "printed" | "needs_review",
        "entities": { medications, diagnoses, lab_results, procedures }
    }
    """
    import uuid
    doc_id = f"doc_{uuid.uuid4().hex[:6]}"

    if not HAS_TESSERACT:
        logger.warning("Tesseract not available — returning mock OCR data")
        entities = llm_client.extract_document_entities("", "prescription")
        return {
            "doc_id": doc_id,
            "ocr_text": "[Mock OCR — Tesseract not installed]",
            "ocr_confidence": 0.0,
            "ocr_path": "mock",
            "entities": entities,
        }

    try:
        image = Image.open(io.BytesIO(image_bytes))

        # ── Step 1: Quick printed-text pass ──
        ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT, lang="eng")

        # Calculate mean confidence (ignoring -1 values which are non-text blocks)
        confidences = [int(c) for c in ocr_data["conf"] if int(c) > 0]
        mean_confidence = sum(confidences) / len(confidences) if confidences else 0

        # Extract the full text
        ocr_text = pytesseract.image_to_string(image, lang="eng")

        # ── Step 2: Confidence gate ──
        if mean_confidence >= CONFIDENCE_THRESHOLD:
            ocr_path = "printed"
        else:
            ocr_path = "needs_review"
            logger.info(f"OCR confidence {mean_confidence:.1f}% below threshold — flagging for review")

        # ── Step 3: NER extraction via LLM ──
        entities = llm_client.extract_document_entities(ocr_text, "prescription")

        return {
            "doc_id": doc_id,
            "ocr_text": ocr_text.strip(),
            "ocr_confidence": round(mean_confidence, 1),
            "ocr_path": ocr_path,
            "entities": entities,
        }

    except Exception as e:
        logger.error(f"OCR pipeline error: {e}")
        entities = llm_client.extract_document_entities("", "unknown")
        return {
            "doc_id": doc_id,
            "ocr_text": f"[OCR Error: {str(e)}]",
            "ocr_confidence": 0.0,
            "ocr_path": "error",
            "entities": entities,
        }
