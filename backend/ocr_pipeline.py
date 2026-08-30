"""
SwasthyaSync — OCR & NER Pipeline (Clinical Vision AI Engine)

Integrates Gemini 2.5 Flash for multimodal medical document digitization.
Replaces legacy Tesseract OCR with direct image-to-JSON reasoning.
"""

from __future__ import annotations
import os
import io
import uuid
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ------------------------------------------------------------------
# 1. Pydantic Schemas (Aligned with FHIR / ABDM Data Model)
# ------------------------------------------------------------------

class LabValue(BaseModel):
    test_name: str = Field(..., description="Standardized lab test name")
    value: str = Field(..., description="Extracted numeric or qualitative result")
    unit: Optional[str] = Field(None, description="Measurement unit")
    reference_range: Optional[str] = Field(None, description="Literal reference range printed")
    is_abnormal: bool = Field(..., description="True if value falls outside reference range or is clinically risky")
    flag_reason: Optional[str] = Field(None, description="Clear 1-sentence medical explanation when abnormal")

class Medication(BaseModel):
    drug_name: str = Field(..., description="Exact brand name or generic chemical compound")
    dosage: Optional[str] = Field(None, description="Numeric strength and unit")
    frequency: Optional[str] = Field(None, description="Standardized frequency (e.g., '1-0-1')")
    duration: Optional[str] = Field(None, description="Length of course (e.g., '5 days')")
    instructions: Optional[str] = Field(None, description="Dietary or temporal constraints")

class Diagnosis(BaseModel):
    condition_name: str = Field(..., description="Diagnosis, chief complaint, provisional diagnosis")
    status: str = Field("active", description="active | historical | suspected")

class DigitizedDocument(BaseModel):
    doc_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique short document identifier")
    filename: Optional[str] = Field(None, description="Original uploaded filename")
    document_type: str = Field(..., description="prescription | lab_report | discharge_summary | surgery_record | clinical_note | unknown")
    issue_date: Optional[str] = Field(None, description="ISO 8601 date YYYY-MM-DD")
    date_confidence: str = Field("exact", description="exact | estimated | missing")
    detected_languages: List[str] = Field(default_factory=list, description="Languages/scripts detected")
    diagnoses: List[Diagnosis] = Field(default_factory=list)
    medications: List[Medication] = Field(default_factory=list)
    lab_values: List[LabValue] = Field(default_factory=list)
    surgical_history: List[str] = Field(default_factory=list)
    past_medical_history: List[str] = Field(default_factory=list)
    clinical_summary: str = Field(..., description="Concise clinical summary")
    requires_human_verification: bool = Field(..., description="True if handwriting unclear or values critical")
    verification_reasons: List[str] = Field(default_factory=list)

# ------------------------------------------------------------------
# 2. Gemini 2.5 Flash — Clinical Vision AI Engine
# ------------------------------------------------------------------

SYSTEM_PROMPT = """
You are an expert Clinical Vision AI Engine specialized in Document Digitization, Multilingual OCR, Medical Handwriting Recognition, and Structured Entity Extraction for the Indian Healthcare Ecosystem (Ayushman Bharat Digital Mission / ABDM Standard).

Your task is to analyze the provided medical document image (prescriptions, lab reports, discharge summaries, surgical notes, or doctor's clinical notes) and extract high-precision, structured clinical data.

1. MULTILINGUAL SCRIPT & HANDWRITING OCR RULES
- Script Handling: Read text in English as well as all Indic scripts.
- Handwriting Disambiguation: Intelligently parse messy doctor handwriting, standard medical abbreviations.
- Translation: Translate non-English clinical descriptions into standard medical English.

2. CLINICAL ENTITY EXTRACTION RULES
Extract data into categories: Diagnoses, Medications, Lab Values, Surgical & Past Medical History.

3. LAB DEFECT & ABNORMALITY INTERPRETATION
- Explicit Reference Range Check: Compare value against reference_range.
- Implicit Clinical Knowledge Check: Evaluate risk if range missing.
- Flag Reason: When abnormal, provide 1-sentence medical explanation.

4. DATE EXTRACTION & NORMALIZATION
- Standard ISO 8601 format: YYYY-MM-DD.

5. PHYSICIAN VERIFICATION SAFETY GATE
Set requires_human_verification = true if handwriting smudged, dosage unreadable, lab values critical, or details conflicting. Explicitly list verification_reasons.

6. OUTPUT FORMAT REQUIREMENTS
Return ONLY a valid JSON object matching the requested schema.
"""

async def process_document(image_bytes: bytes, filename: str = "document.jpg", media_type: str = "image/jpeg") -> dict:
    """
    Process an uploaded document image through Gemini Multimodal extraction.
    Returns the serialized dictionary of DigitizedDocument to remain compatible with existing downstream processes,
    but containing the much richer schema.
    """
    if not client:
        logger.error("GEMINI_API_KEY not set. Document extraction will fail or return mock data.")
        return {"doc_id": "mock_id", "document_type": "unknown", "error": "API Key missing"}

    models_to_try = ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            logger.info(f"Attempting OCR vision extraction with model: {model_name}")
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=media_type),
                    "Analyze this medical document image. Extract all clinical entities following your instruction rules. Return structured JSON."
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DigitizedDocument,
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.0
                )
            )
            doc = response.parsed
            if doc:
                doc.filename = filename
                logger.info(f"OCR vision extraction succeeded with model {model_name}")
                return doc.model_dump()
        except Exception as e:
            last_error = str(e)
            logger.warning(f"OCR vision extraction failed with model {model_name}: {last_error}")

    logger.error(f"All OCR vision extraction models failed. Last error: {last_error}")
    return {"doc_id": "error_id", "document_type": "unknown", "error": last_error or "Extraction failed"}
