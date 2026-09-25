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

    system_prompt = f"""You are a senior clinical consultant designing a structured, focused patient intake schema.

Your task: Given a patient's chief complaint and demographics, generate a concise, complaint-specific JSON schema of fields that an intake assistant should collect.{doctor_instruction_text}

CRITICAL RULES:
1. The schema must be HIGHLY SPECIFIC to the chief complaint. Do NOT include generic screening questions that are irrelevant.
2. Generate 15 to 30 high-yield clinical fields total. Cover the following areas comprehensively:
   - Onset / duration / mode of onset (HPI)
   - Severity / intensity / character / quality of symptom (HPI)
   - Exact anatomical location and radiation/spread (HPI)
   - Aggravating and relieving factors (HPI)
   - Associated symptoms (fever, nausea, vomiting, etc.) (HPI)
   - Prior episodes of same complaint (HPI)
   - Any recent trauma, travel, or exposure (HPI)
   - Primary red-flag / safety sign for this condition (red_flag_check)
   - Secondary safety signs relevant to the complaint (red_flag_check)
   - Relevant chronic illnesses / past medical history (PMH)
   - Past surgeries or hospitalizations (PMH)
   - Current medications (DH)
   - Known drug or food allergies (DH)
   - Family history relevant to the complaint (FH)
   - Occupation and daily routine if relevant (SH)
   - Smoking / alcohol / substance use if relevant (SH)
   - Menstrual history if female patient and complaint is relevant (HPI)
   - Review of systems questions relevant to the complaint (ROS)
3. Each field must have a clear, natural question_intent.
4. Assign priority: "critical" (must ask), "high" (should ask), "medium" (nice to have), "optional" (if time permits).
5. Mark red_flag: true ONLY if a positive answer indicates an acute medical emergency.
6. Set fork_eligible: false by default. See FORKING RULES below for when to enable it.
7. Output ONLY a valid JSON object matching the schema below. Generate between 15 and 30 fields.

CANONICAL FIELD ID REFERENCE (A2):
When generating fields for these common clinical concepts, use EXACTLY these field IDs:
- When symptoms started:              symptom_onset
- Severity/intensity of complaint:    symptom_severity_impact
- Prior similar episodes:             prior_episodes
- Current regular medications:        current_medications
- Drug or food allergies:             known_allergies
- Existing chronic conditions:        chronic_conditions
For all other complaint-specific fields, use descriptive snake_case IDs unique to the complaint.

FORKING RULES (B1 — Static pre-declared forking, zero runtime LLM):
1. You MAY mark up to 5 fields as fork_eligible: true.
2. For each fork-eligible field, populate forks_on_positive with an array of child field IDs.
3. Each fork-eligible parent has MAX 3 child fields. Never more.
4. ALL child fields MUST also be declared as full field objects in the "fields" array.
5. Child fields MUST have conditional_on set to "parent_field_id:yes".
6. Child fields MUST have fork_eligible: false and forks_on_positive: [].
7. Total fields (base + all fork children) must not exceed 30.
8. Only fork when the patient’s positive answer meaningfully changes the clinical picture.
   GOOD fork triggers: pain radiation, associated fever, breathlessness, bleeding, loss of consciousness.
   BAD fork triggers: general lifestyle, mild associated symptoms, chronic stable history.
9. Fields where forking adds no clinical value: set fork_eligible: false, forks_on_positive: [].

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
      "forks_on_positive": [],
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
                max_output_tokens=6000,
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
    
    # Minimal universal baseline fields
    baseline = [
        {"id": "symptom_duration", "question_intent": "How long has it been going on", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_severity", "question_intent": "How severe is the problem", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "current_medications", "question_intent": "Any medications currently being taken", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "DH", "conditional_on": None},
        {"id": "chronic_conditions", "question_intent": "Any existing chronic health conditions", "type": "string", "priority": "medium", "red_flag": False, "fork_eligible": False, "category": "PMH", "conditional_on": None},
    ]

    # Merge baseline + safety floor, avoiding duplicates, capping at 30
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
    """Validate and clean the generated schema. Enforces caps and fork integrity."""
    schema.setdefault("chief_complaint", chief_complaint)
    fields = schema.get("fields", [])
    is_ayush_schema = is_ayush or any(f.get("category") == "PRAKRITI" for f in fields)

    # Build a set of declared field IDs for fork child validation
    declared_ids = {f.get("id", "") for f in fields if f.get("id")}

    # Ensure all fields have required keys
    valid_fields = []
    seen_ids = set()
    for f in fields:
        fid = f.get("id", "")
        if not fid or fid in seen_ids:
            continue
        seen_ids.add(fid)

        # Ensure defaults
        f.setdefault("question_intent", f.get("id", "").replace("_", " "))
        f.setdefault("type", "string")
        f.setdefault("priority", "medium")
        f.setdefault("red_flag", False)
        f.setdefault("fork_eligible", False)
        f.setdefault("forks_on_positive", [])
        f.setdefault("category", "HPI")
        f.setdefault("conditional_on", None)

        # B1: Fork integrity checks
        forks_on_positive = f.get("forks_on_positive", [])
        if not isinstance(forks_on_positive, list):
            f["forks_on_positive"] = []
            forks_on_positive = []

        if f.get("fork_eligible"):
            # Remove child IDs that don't exist in the schema
            valid_children = [cid for cid in forks_on_positive if cid in declared_ids and cid != fid]
            f["forks_on_positive"] = valid_children[:3]  # Max 3 children
            # If no valid children, disable fork_eligible
            if not f["forks_on_positive"]:
                f["fork_eligible"] = False
        else:
            f["forks_on_positive"] = []  # Non-fork-eligible fields have empty list

        # B1: Fork children must not themselves be fork-eligible (no recursion)
        if f.get("conditional_on") and ":yes" in str(f.get("conditional_on", "")):
            f["fork_eligible"] = False
            f["forks_on_positive"] = []

        # Validate priority
        if f["priority"] not in ("critical", "high", "medium", "optional"):
            f["priority"] = "medium"

        valid_fields.append(f)

    # B1: Enforce max 5 fork parents and max 15 total fork children
    fork_parents = [f for f in valid_fields if f.get("fork_eligible")]
    if len(fork_parents) > 5:
        # Keep the 5 with highest priority
        pw = {"critical": 0, "high": 1, "medium": 2, "optional": 3}
        fork_parents.sort(key=lambda x: pw.get(x.get("priority", "medium"), 2))
        for fp in fork_parents[5:]:
            fp["fork_eligible"] = False
            fp["forks_on_positive"] = []

    # If standard allopathic schema exceeds 30 fields, prioritize critical/red-flag items and cap at 30
    if not is_ayush_schema and len(valid_fields) > 30:
        priority_weights = {"critical": 0, "high": 1, "medium": 2, "optional": 3}
        valid_fields.sort(key=lambda x: (priority_weights.get(x.get("priority", "medium"), 2), not x.get("red_flag", False)))
        valid_fields = valid_fields[:30]

    schema["fields"] = valid_fields
    return schema
