"""
SwasthyaSync v4 — Conversation Engine (Stage 2)

Two-step per-turn logic using the fast/cheap model:
  1. EXTRACTION: Given patient's message + unfilled fields → extract values
  2. QUESTION GENERATION: Given target field + context → one natural question

This replaces the old single-call approach with a more reliable pipeline.
"""

from __future__ import annotations
import json
import logging
import time

import llm_client
from fast_path_cache import get_cached_question

logger = logging.getLogger(__name__)

# Language names for prompt building
LANGUAGE_NAMES = {
    "hi-IN": "Hindi (हिन्दी)",
    "ta-IN": "Tamil (தமிழ்)",
    "te-IN": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "bn-IN": "Bengali (বাংলা)",
    "mr-IN": "Marathi (मराठी)",
    "gu-IN": "Gujarati (ગુજરાતી)",
    "ml-IN": "Malayalam (മലയാളം)",
    "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
    "or-IN": "Odia (ଓଡ଼ିଆ)",
    "en-IN": "English",
}


class ConversationResult:
    """Result from a single conversation turn."""

    def __init__(self, raw: dict):
        self.spoken_text: str = raw.get("spoken_text", "")
        self.suggested_options: list[dict] = raw.get("suggested_options", [])
        self.extracted_fields: dict = raw.get("extracted_fields", {})
        self.red_flag_check: str | None = raw.get("red_flag_check")
        self.reasoning: str = raw.get("reasoning", "")
        self.current_category: str = raw.get("current_category", "HPI")


# ──────────────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────────────
# STEP 1: SINGLE-TARGET FIELD EXTRACTION (Zero-Hallucination)
# ──────────────────────────────────────────────────────────────────────

# Deterministic negative-answer patterns — skips LLM call entirely
_NEGATIVE_PATTERNS = frozenset([
    "no", "none", "nahi", "nah", "nahin", "na", "denied", "denies",
    "nothing", "nil", "not applicable", "n/a", "no issues", "no problem",
    "koi nahi", "kuch nahi", "nope", "never", "not sure", "don't know",
    "healthy", "normal", "fine", "none of these", "inme se kuch nahi",
    "kuch bhi nahi",
])

def _is_negative_answer(answer: str) -> bool:
    """Fast deterministic check — if True, skip LLM calls entirely and record Denied."""
    clean = str(answer or "").strip().lower().rstrip(".!,")
    if clean in _NEGATIVE_PATTERNS:
        return True
    if clean.startswith(("no ", "no,", "none ", "nahi ", "nah ", "kuch nahi", "koi nahi")):
        return True
    return False


def extract_single_target_field(
    target_field: dict,
    patient_message: str,
    language: str = "en-IN",
) -> dict:
    """
    Tightly constrained, single-field extraction.
    Extracts/summarizes the patient's answer strictly for the target field.
    Guaranteed zero hallucination across other fields.
    Returns: {"value": str, "confidence": float}
    """
    clean_msg = str(patient_message or "").strip()
    if not clean_msg:
        return {"value": None, "confidence": 0.0}

    # Deterministic negative check — bypass LLM completely
    if _is_negative_answer(clean_msg):
        return {"value": "Denied / None", "confidence": 1.0}

    language_name = LANGUAGE_NAMES.get(language, "English")
    field_id = target_field.get("id", "target_field")
    field_intent = target_field.get("question_intent", field_id.replace("_", " "))

    system_prompt = f"""You are a precise clinical data extraction tool.
The doctor asked the patient a specific question:
Target Field: {field_id} ({field_intent})

Your ONLY task: Extract a concise clinical summary (2-6 words in English) answering THIS specific question from the patient's statement (which may be in {language_name} or English).

RULES:
1. ONLY extract information that directly answers '{field_intent}'. Do NOT infer, guess, or extract unrelated symptoms.
2. If the patient denies or says no/nothing, return: {{"value": "Denied / None", "confidence": 1.0}}
3. If the patient's answer does not answer '{field_intent}', return: {{"value": null, "confidence": 0.0}}
4. Return ONLY a JSON object: {{"value": "concise English summary", "confidence": 0.95}}"""

    user_prompt = f"""Patient statement: "{clean_msg}"

Extract the value for '{field_intent}':"""

    try:
        res = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.0)
        val = res.get("value")
        conf = float(res.get("confidence", 0.9)) if val else 0.0
        if val and str(val).strip().lower() not in ("none", "null", ""):
            return {"value": str(val).strip(), "confidence": conf}
        return {"value": None, "confidence": 0.0}
    except Exception as e:
        logger.error(f"extract_single_target_field error for '{field_id}': {e}")
        return {"value": clean_msg[:60], "confidence": 0.7}


def extract_from_response(
    patient_message: str,
    unfilled_fields: list[dict],
    filled_summary: str,
    conversation_history: list[dict],
    language: str,
    doctor_custom_instructions: str | None = None,
) -> tuple[dict, list[dict]]:
    """
    Initial extraction pass for chief complaint only.
    Returns: (extracted_fields, []) — additional unprompted findings are disabled to prevent hallucinations.
    """
    if not patient_message.strip():
        return {}, []

    language_name = LANGUAGE_NAMES.get(language, "English")

    field_descriptions = []
    for f in unfilled_fields[:20]:  # Limit to top 20 baseline fields
        field_descriptions.append(f"- {f['id']}: {f.get('question_intent', f['id'])}")
    fields_text = "\n".join(field_descriptions)

    system_prompt = f"""You are a precise clinical data extraction tool.
Given the patient's chief complaint statement (in {language_name} or English), extract any clearly stated values that map directly to the listed unfilled fields (such as duration or pain site).

RULES:
1. Only extract information that the patient EXPLICITLY stated. Do NOT infer or guess.
2. If not explicitly stated, do NOT include the field.
3. Values must be concise English summaries.
4. Output ONLY a JSON object:
{{
  "extracted_fields": {{
    "field_id": {{"value": "concise summary", "confidence": 0.95}}
  }}
}}"""

    user_prompt = f"""=== FIELDS TO EXTRACT INTO ===
{fields_text}

=== PATIENT'S STATEMENT ===
{patient_message}

Extract explicit field values:"""

    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.0)
        extracted = result.get("extracted_fields", {})
        valid_field_ids = {f["id"] for f in unfilled_fields}
        validated = {}
        for fid, entry in extracted.items():
            if fid in valid_field_ids and isinstance(entry, dict) and entry.get("value"):
                validated[fid] = entry
        return validated, []
    except Exception as e:
        logger.error(f"Initial extraction failed: {e}")
        return {}, []


def check_and_generate_fork_questions(
    parent_field: dict,
    patient_answer: str,
    chief_complaint: str,
    language: str,
    doctor_custom_instructions: str | None = None,
) -> list[dict] | None:
    """
    Disabled: Dynamic schema forking is turned off to ensure zero hallucination
    and bounded, predictable intake interviews.
    """
    return None


# ──────────────────────────────────────────────────────────────────────
# STEP 2: QUESTION GENERATION — generate one natural question
# ──────────────────────────────────────────────────────────────────────

def generate_question(
    target_field: dict,
    filled_summary: str,
    conversation_history: list[dict],
    language: str,
    patient_message: str = "",
    chief_complaint: str = "",
    patient_age: int | None = None,
    patient_sex: str = "",
    previous_history: dict | None = None,
    doctor_custom_instructions: str | None = None,
) -> ConversationResult:
    """
    Generate one natural, conversational question for the target field.
    
    Also generates contextual suggested_options for the patient to tap.
    """
    language_name = LANGUAGE_NAMES.get(language, "English")
    field_id = target_field.get("id", "unknown")
    question_intent = target_field.get("question_intent", "")
    category = target_field.get("category", "HPI")
    is_red_flag = target_field.get("red_flag", False)

    # Fast-Path Cache Check (< 5ms response for common clinical intake fields)
    cached = get_cached_question(field_id, language)
    if cached:
        logger.info(f"⚡ Fast-Path Cache hit for field={field_id}, language={language}")
        return ConversationResult({
            "spoken_text": cached["spoken_text"],
            "suggested_options": cached["suggested_options"],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "Fast-Path cache hit (< 5ms)",
            "current_category": category,
        })

    # Last messages for context
    recent_msgs = conversation_history[-6:] if conversation_history else []
    context_text = ""
    if recent_msgs:
        lines = []
        for m in recent_msgs:
            role = "Doctor" if m["role"] == "assistant" else "Patient"
            lines.append(f"{role}: {m['content']}")
        context_text = "\n".join(lines)

    age_str = f"{patient_age} years old" if patient_age else ""
    sex_str = patient_sex or ""
    demo_str = f"Patient: {age_str} {sex_str}".strip()

    # Language instruction
    if language == "en-IN":
        lang_rule = "Respond in simple, clear English suitable for Indian patients."
    else:
        lang_rule = f"""CRITICAL LANGUAGE RULE:
- You MUST respond ENTIRELY in {language_name} using native script.
- spoken_text and all label_translated MUST be in {language_name}.
- Do NOT use English or Romanized text in spoken_text or label_translated.
- The label field in suggested_options should remain in English (for backend).
- The patient speaks {language_name}. Respond warmly in {language_name}."""

    system_prompt = f"""You are a polite, direct medical kiosk intake assistant conducting a structured clinical triage.

{lang_rule}

{demo_str}
Chief Complaint: {chief_complaint}
{"DOCTOR'S CUSTOM INSTRUCTIONS: " + doctor_custom_instructions if doctor_custom_instructions else ""}

YOUR TASK: Ask the patient ONE direct question about this clinical topic:
  Field: {field_id}
  Intent: {question_intent}
  Category: {category}
  {"⚠️ This is an essential SAFETY check — ask it clearly." if is_red_flag else ""}

CRITICAL RULES (ANTI-HALLUCINATION & ANTI-FLUFF):
1. Ask ONE single, clear, direct question. Do NOT bundle multiple symptoms together.
2. NEVER use repetitive emotional filler phrases such as "मैं आपकी परेशानी को समझ रहा हूँ", "मुझे दुख है", or "I understand your pain". Ask the question directly, politely, and respectfully.
3. Be polite, clear, and use simple everyday language without medical jargon.
4. Generate 3 to 4 distinct, contextually accurate suggested options the patient can tap.
5. ALWAYS include a clear negative option as the final option:
   {{"label": "None of these", "label_translated": "इनमें से कुछ नहीं"}} (or "No" / "नहीं").
6. Do NOT suggest diagnoses or treatments.

OUTPUT FORMAT — Return ONLY a JSON object:
{{
  "spoken_text": "Your direct question in {language_name}",
  "suggested_options": [
    {{"label": "English label", "label_translated": "Label in {language_name}"}},
    ...
  ],
  "reasoning": "Brief clinical reasoning in English"
}}"""

    user_prompt = f"""=== ALREADY KNOWN INFORMATION ===
{filled_summary}

=== CONVERSATION SO FAR ===
{context_text}

{f"=== PAST MEDICAL CONTEXT (FOLLOW-UP VISIT) ==={chr(10)}The patient visited on {previous_history.get('completed_at', 'an earlier date')}.{chr(10)}Chief Complaint: {previous_history.get('chief_complaint')}{chr(10)}Diagnosis: {previous_history.get('small_summary')}{chr(10)}Prescription: {previous_history.get('doctor_prescription')}{chr(10)}Use this context to inform your questions if relevant, but stay focused on the current target field." if previous_history else ""}

{"=== PATIENT'S LAST MESSAGE ===" + chr(10) + patient_message if patient_message else "This is the opening question. No patient message yet."}

Generate your direct question about: {question_intent}"""

    t0 = time.time()
    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.1)
        elapsed = time.time() - t0

        spoken_text = result.get("spoken_text", "")
        options = result.get("suggested_options", [])
        reasoning = result.get("reasoning", "")

        if not spoken_text:
            spoken_text = _fallback_question(question_intent, language_name)
        if not options:
            options = _fallback_options(language_name)

        # Guarantee a clean negative option exists
        has_negative = any("none" in str(opt.get("label", "")).lower() or "no" == str(opt.get("label", "")).lower().strip() for opt in options)
        if not has_negative:
            if language == "hi-IN":
                options.append({"label": "None of these", "label_translated": "इनमें से कुछ नहीं"})
            elif language == "en-IN":
                options.append({"label": "None of these", "label_translated": "None of these"})
            else:
                options.append({"label": "None of these", "label_translated": "None of these"})

        logger.info(f"Question generation took {elapsed:.2f}s | field={field_id} | category={category}")

        return ConversationResult({
            "spoken_text": spoken_text,
            "suggested_options": options,
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": reasoning,
            "current_category": category,
        })

    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Question generation failed after {elapsed:.2f}s: {e}")
        return ConversationResult({
            "spoken_text": _fallback_question(question_intent, language_name),
            "suggested_options": _fallback_options(language_name),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": f"Fallback — error: {e}",
            "current_category": category,
        })


# ──────────────────────────────────────────────────────────────────────
# OPENING QUESTION — for the very first turn (chief complaint)
# ──────────────────────────────────────────────────────────────────────

def generate_opening_question(
    language: str,
    patient_name: str = "",
    patient_age: int | None = None,
    patient_sex: str = "",
    previous_history: dict | None = None,
    doctor_custom_instructions: str | None = None,
) -> ConversationResult:
    """Generate the opening chief complaint question."""
    language_name = LANGUAGE_NAMES.get(language, "English")

    name_str = f" {patient_name}" if patient_name else ""
    
    if language == "en-IN":
        lang_rule = "Respond in simple, clear English."
    else:
        lang_rule = f"You MUST respond ENTIRELY in {language_name} using native script. spoken_text and label_translated must be in {language_name}."

    follow_up_prompt = ""
    if previous_history:
        follow_up_prompt = f"""
This is a FOLLOW-UP VISIT. The patient was here on {previous_history.get('completed_at')}.
Previous diagnosis: {previous_history.get('small_summary')}
Previous treatment: {previous_history.get('doctor_prescription')}
Instead of a generic "what brings you here", ask how they are doing since their last visit regarding this issue, or if there is a new problem.
"""

    system_prompt = f"""You are a compassionate medical kiosk assistant.
{lang_rule}

Generate a warm opening question to ask the patient what brings them here today.
{"Address them as " + name_str + "." if name_str else ""}
{follow_up_prompt}
{"DOCTOR'S CUSTOM INSTRUCTIONS FOR INTERVIEW: " + doctor_custom_instructions if doctor_custom_instructions else ""}

OUTPUT FORMAT — Return ONLY a JSON object:
{{
  "spoken_text": "Your warm greeting and opening question in {language_name}",
  "suggested_options": [
    {{"label": "English label", "label_translated": "Label in {language_name}"}},
    ...
  ]
}}

Include 5-8 common complaint options like: Fever, Pain, Cough, Stomach problem, Weakness, Skin issue, Breathing difficulty, Something else."""

    user_prompt = f"Generate the opening question for the patient interview."

    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.3)
        return ConversationResult({
            "spoken_text": result.get("spoken_text", "What brings you here today?"),
            "suggested_options": result.get("suggested_options", _fallback_options(language_name)),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "",
            "current_category": "CHIEF_COMPLAINT",
        })
    except Exception as e:
        logger.error(f"Opening question generation failed: {e}")
        return ConversationResult({
            "spoken_text": "What brings you here today?",
            "suggested_options": _fallback_options(language_name),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": f"Fallback: {e}",
            "current_category": "CHIEF_COMPLAINT",
        })


# ──────────────────────────────────────────────────────────────────────
# CLOSING — generate a summary confirmation message
# ──────────────────────────────────────────────────────────────────────

def generate_closing(language: str, filled_summary: str) -> ConversationResult:
    """Generate a closing message summarizing what was collected."""
    language_name = LANGUAGE_NAMES.get(language, "English")

    if language == "en-IN":
        lang_rule = "Respond in English."
    else:
        lang_rule = f"Respond ENTIRELY in {language_name} using native script."

    system_prompt = f"""You are a compassionate medical kiosk assistant.
{lang_rule}
The interview is complete. Thank the patient and let them know their information will be shared with the doctor.
Keep it brief (1-2 sentences).

OUTPUT FORMAT — Return ONLY: {{"spoken_text": "your closing message"}}"""

    try:
        result = llm_client.conversation_turn(system_prompt, filled_summary, temperature=0.2)
        return ConversationResult({
            "spoken_text": result.get("spoken_text", "Thank you. Your doctor will review this information."),
            "suggested_options": [],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "",
            "current_category": "COMPLETE",
        })
    except Exception:
        return ConversationResult({
            "spoken_text": "Thank you. Your doctor will review this information.",
            "suggested_options": [],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "Fallback",
            "current_category": "COMPLETE",
        })


# ──────────────────────────────────────────────────────────────────────
# FALLBACKS
# ──────────────────────────────────────────────────────────────────────

def _fallback_question(intent: str, language_name: str) -> str:
    return f"Can you tell me about: {intent}?"


def _fallback_options(language_name: str) -> list[dict]:
    return [
        {"label": "Yes", "label_translated": "Yes"},
        {"label": "No", "label_translated": "No"},
        {"label": "Not sure", "label_translated": "Not sure"},
        {"label": "Something else", "label_translated": "Something else"},
    ]
