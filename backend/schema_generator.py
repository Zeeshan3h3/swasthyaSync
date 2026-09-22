"""
SwasthyaSync v4 — Dynamic Schema Generator (Stage 1)

Called ONCE per encounter, immediately after chief complaint + demographics.
Uses a heavy model (Gemini 3.6 Flash) to generate a complaint-specific
clinical interview schema.

Two-call strategy:
  1. Generate relevant categories (decide which sections matter for this complaint)
  2. Expand each included category into specific fields

The generated schema is then validated against the red-flag safety floor
to ensure all must-ask fields are present.
"""

from __future__ import annotations
import json
import logging
import time

import llm_client
from red_flag_library import get_safety_floor, get_safety_floor_as_text, merge_safety_floor

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Stage 1 Model — heavier model called once per encounter
# ──────────────────────────────────────────────────────────────────────
SCHEMA_MODEL_PRIMARY = "gemini-3.5-flash-lite"
SCHEMA_MODEL_FALLBACK = "gemini-3.6-flash"

# Language names for demographic context
LANGUAGE_NAMES = {
    "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu",
    "kn-IN": "Kannada", "bn-IN": "Bengali", "mr-IN": "Marathi",
    "gu-IN": "Gujarati", "ml-IN": "Malayalam", "pa-IN": "Punjabi",
    "or-IN": "Odia", "en-IN": "English",
}


def _build_schema_generation_prompt(
    chief_complaint: str,
    patient_age: int | None,
    patient_sex: str,
    category: str,
    safety_floor_text: str,
    doctor_custom_instructions: str | None = None,
) -> tuple[str, str]:
    """Build the system and user prompts for schema generation."""

    age_str = f"{patient_age} years old" if patient_age else "age unknown"
    sex_str = patient_sex or "unknown sex"
    
    doctor_instruction_text = ""
    if doctor_custom_instructions:
        doctor_instruction_text = f"\n\nCRITICAL DOCTOR INSTRUCTIONS:\nThe attending physician for this patient has provided the following custom intake instructions: \"{doctor_custom_instructions}\"\nYou MUST adjust your generated JSON schema to explicitly include fields that capture this specific information."

    system_prompt = f"""You are a senior clinical consultant designing a comprehensive, structured patient intake schema based on the Macleod's Clinical Examination framework.

Your task: Given a patient's chief complaint and demographics, generate a detailed, complaint-specific JSON schema of 15 to 30 fields that an intake assistant should collect.{doctor_instruction_text}

CRITICAL RULES:
1. The schema must be HIGHLY SPECIFIC to the chief complaint. Do NOT include generic screening questions that are completely irrelevant (e.g., do NOT ask about eye surgery for an isolated ankle sprain).
2. Generate 15 to 30 clinical fields total across relevant clinical categories:
   - HPI (History of Present Illness: onset, duration, character, anatomical location, severity, radiation, aggravating/relieving factors) — ALWAYS relevant
   - PMH (Past Medical History) — previous episodes, relevant chronic illnesses
   - DH (Drug History / Allergies) — current medications, adverse reactions
   - FH (Family History) — relevant hereditary risks
   - SH (Social History) — relevant habits, smoking, alcohol, occupation, lifestyle
   - ROS (Review of Systems) — associated systemic symptoms
   - red_flag_check — safety-critical emergency screening questions
3. Each field must have a clear, natural question_intent.
4. Assign priority: "critical" (must ask), "high" (should ask), "medium" (nice to have), "optional" (if time permits).
5. Mark red_flag: true ONLY if a positive answer indicates an acute medical emergency.
6. Set fork_eligible: false for all fields (forking is disabled).
7. Output ONLY a valid JSON object matching the schema below. Generate between 15 and 30 fields.

The following fields are MANDATORY red-flag safety requirements for this complaint category. They MUST appear in your schema:
{safety_floor_text}

Output ONLY a JSON object with this exact structure:
{{
  "chief_complaint": "the complaint as understood",
  "fields": [
    {{
      "id": "unique_snake_case_id",
      "question_intent": "what this field is trying to learn, in plain language",
      "type": "string",
      "priority": "critical|high|medium|optional",
      "red_flag": true/false,
      "fork_eligible": false,
      "category": "HPI|PMH|DH|FH|SH|ROS|red_flag_check",
      "conditional_on": null
    }}
  ]
}}"""

    user_prompt = f"""Patient: {age_str}, {sex_str}
Chief Complaint: {chief_complaint}
Complaint Category: {category}

Generate the clinical interview schema for this specific patient and complaint. Remember:
- Be complaint-specific, not generic
- Include the mandatory safety floor fields listed in your instructions
{"- CRITICAL: You MUST include specific fields to capture the doctor's custom intake instructions." if doctor_custom_instructions else ""}
- Order fields by clinical priority (most important first within each category)"""

    return system_prompt, user_prompt


def generate_schema(
    chief_complaint: str,
    patient_age: int | None,
    patient_sex: str,
    category: str,
    doctor_custom_instructions: str | None = None,
    clinic_mode: str | None = None,
) -> dict:
    """
    Generate a complaint-specific clinical interview schema.
    
    Called ONCE per encounter after chief complaint capture.
    Uses a heavier model for quality, with fallback to a static schema.
    
    Returns: A validated schema dict with "chief_complaint" and "fields" keys.
    """
    # Auto-detect clinic_mode if not explicitly passed (e.g. from DialogueManager)
    if clinic_mode is None:
        try:
            import inspect
            frame = inspect.currentframe().f_back
            dm = frame.f_locals.get("self")
            clinic_mode = getattr(getattr(dm, "record", None), "clinic_mode", "allopathic")
        except Exception:
            clinic_mode = "allopathic"

    if clinic_mode is not None:
        cm_lower = str(clinic_mode).lower().strip()
        if "ayush" in cm_lower or "ayur" in cm_lower:
            clinic_mode = "ayush"

    # AYUSH / Integrative Mode: Use fixed CCRAS template (Non-negotiable architectural invariant)
    if clinic_mode in ("ayush", "integrative"):
        logger.info(f"Generating FIXED AYUSH schema for mode '{clinic_mode}', complaint '{chief_complaint}'")
        from ayush_templates import get_ayush_schema
        schema = get_ayush_schema(chief_complaint, category)
        # SAFETY: Mandatory safety floor is STILL merged! (Pillar 1 Protection)
        schema = merge_safety_floor(schema, category)
        return _validate_schema(schema, chief_complaint)

    safety_floor_text = get_safety_floor_as_text(category)
    system_prompt, user_prompt = _build_schema_generation_prompt(
        chief_complaint, patient_age, patient_sex, category, safety_floor_text, doctor_custom_instructions
    )

    t0 = time.time()

    # Try the primary heavy model first
    schema = _call_model_for_schema(SCHEMA_MODEL_PRIMARY, system_prompt, user_prompt)

    # Fallback to lighter model if primary fails
    if schema is None:
        logger.warning(f"Primary schema model ({SCHEMA_MODEL_PRIMARY}) failed, trying fallback ({SCHEMA_MODEL_FALLBACK})")
        schema = _call_model_for_schema(SCHEMA_MODEL_FALLBACK, system_prompt, user_prompt)

    # Fallback to static schema if all LLM calls fail
    if schema is None:
        logger.error("All schema generation models failed — using static fallback schema")
        schema = _build_static_fallback(chief_complaint, category)

    # SAFETY: Merge the must-ask safety floor into the schema
    schema = merge_safety_floor(schema, category)

    # Validate and clean
    schema = _validate_schema(schema, chief_complaint)

    elapsed = time.time() - t0
    field_count = len(schema.get("fields", []))
    logger.info(f"Schema generation took {elapsed:.2f}s | {field_count} fields | category={category}")

    return schema


def _call_model_for_schema(model: str, system_prompt: str, user_prompt: str) -> dict | None:
    """Call a specific model for schema generation. Returns None on failure."""
    try:
        from google import genai
        from google.genai import types as genai_types
        import os

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=2048,
                automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        result = json.loads(response.text)

        # Basic validation
        if "fields" in result and isinstance(result["fields"], list):
            logger.info(f"Schema generated by {model}: {len(result['fields'])} fields")
            return result
        else:
            logger.warning(f"Schema from {model} missing 'fields' key")
            return None

    except Exception as e:
        logger.error(f"Schema generation with {model} failed: {e}")
        return None


def _build_static_fallback(chief_complaint: str, category: str) -> dict:
    """
    Build a static fallback schema from the red-flag library.
    Used when all LLM calls fail. Ensures the app never breaks.
    """
    safety_fields = get_safety_floor(category)
    
    # Universal baseline fields (Macleod's intake framework)
    baseline = [
        {"id": "symptom_onset", "question_intent": "When did the problem start and was it sudden or gradual", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_duration", "question_intent": "How long has it been going on", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_severity", "question_intent": "How severe is the problem and does it affect daily life", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_character", "question_intent": "What does the symptom feel like", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "aggravating_relieving", "question_intent": "What makes the symptoms better or worse", "type": "string", "priority": "medium", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "current_medications", "question_intent": "Any medications currently being taken", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "DH", "conditional_on": None},
        {"id": "known_allergies", "question_intent": "Any known drug or food allergies", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "DH", "conditional_on": None},
        {"id": "chronic_conditions", "question_intent": "Any existing chronic health conditions (diabetes, hypertension, asthma, etc)", "type": "string", "priority": "medium", "red_flag": False, "fork_eligible": False, "category": "PMH", "conditional_on": None},
        {"id": "prior_episodes", "question_intent": "Has this happened previously in the past", "type": "string", "priority": "medium", "red_flag": False, "fork_eligible": False, "category": "PMH", "conditional_on": None},
        {"id": "family_history", "question_intent": "Any family history of similar conditions or hereditary diseases", "type": "string", "priority": "optional", "red_flag": False, "fork_eligible": False, "category": "FH", "conditional_on": None},
        {"id": "lifestyle_habits", "question_intent": "Smoking, tobacco, alcohol use, or relevant lifestyle habits", "type": "string", "priority": "optional", "red_flag": False, "fork_eligible": False, "category": "SH", "conditional_on": None},
    ]

    # Merge baseline + safety floor, avoiding duplicates, up to 30 fields
    existing_ids = {f["id"] for f in safety_fields}
    all_fields = list(safety_fields)
    for f in baseline:
        if f["id"] not in existing_ids and len(all_fields) < 30:
            all_fields.append(f)

    return {
        "chief_complaint": chief_complaint,
        "fields": all_fields[:30],
    }


def _validate_schema(schema: dict, chief_complaint: str, is_ayush: bool = False) -> dict:
    """Validate and clean the generated schema. Supports 15-30 fields for allopathic."""
    schema.setdefault("chief_complaint", chief_complaint)
    fields = schema.get("fields", [])
    is_ayush_schema = is_ayush or any(f.get("category") == "PRAKRITI" for f in fields)

    # Ensure all fields have required keys
    valid_fields = []
    seen_ids = set()
    for f in fields:
        fid = f.get("id", "")
        if not fid or fid in seen_ids:
            continue
        seen_ids.add(fid)

        # Ensure defaults & guarantee fork_eligible is False
        f.setdefault("question_intent", f.get("id", "").replace("_", " "))
        f.setdefault("type", "string")
        f.setdefault("priority", "medium")
        f.setdefault("red_flag", False)
        f["fork_eligible"] = False  # Banned to prevent dynamic branch explosion
        f.setdefault("category", "HPI")
        f.setdefault("conditional_on", None)

        # Validate priority
        if f["priority"] not in ("critical", "high", "medium", "optional"):
            f["priority"] = "medium"

        valid_fields.append(f)

    # Cap at 30 fields max to enforce upper bound
    if not is_ayush_schema and len(valid_fields) > 30:
        priority_weights = {"critical": 0, "high": 1, "medium": 2, "optional": 3}
        valid_fields.sort(key=lambda x: (priority_weights.get(x.get("priority", "medium"), 2), not x.get("red_flag", False)))
        valid_fields = valid_fields[:30]

    schema["fields"] = valid_fields
    return schema
