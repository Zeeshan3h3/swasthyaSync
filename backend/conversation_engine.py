"""
MediKiosk v4 — Conversation Engine (Stage 2)

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
# STEP 1: EXTRACTION — extract field values from patient's message
# ──────────────────────────────────────────────────────────────────────

def extract_from_response(
    patient_message: str,
    unfilled_fields: list[dict],
    filled_summary: str,
    conversation_history: list[dict],
    language: str,
) -> dict:
    """
    Given the patient's latest message and a list of unfilled fields,
    extract any field values the patient provided.
    
    Returns: {field_id: {"value": str, "confidence": float}}
    """
    if not patient_message.strip():
        return {}

    language_name = LANGUAGE_NAMES.get(language, "English")

    # Build a compact field list for the extraction prompt
    field_descriptions = []
    for f in unfilled_fields[:15]:  # Cap at 15 to keep extraction scoped and cheap
        field_descriptions.append(f"- {f['id']}: {f.get('question_intent', f['id'])}")
    fields_text = "\n".join(field_descriptions)

    # Last few messages for context
    recent_msgs = conversation_history[-4:] if conversation_history else []
    context_text = ""
    if recent_msgs:
        lines = []
        for m in recent_msgs:
            role = "Doctor" if m["role"] == "assistant" else "Patient"
            lines.append(f"{role}: {m['content']}")
        context_text = "\n".join(lines)

    system_prompt = f"""You are a medical data extraction engine.

Given a patient's message (potentially in {language_name}), extract any clinical information that maps to the listed fields.

RULES:
1. Only extract information that the patient CLEARLY stated. Do not infer or guess.
2. If the patient's message doesn't contain information for a field, do NOT include that field.
3. Values should be concise summaries in English (for structured storage).
4. Assign confidence: 0.9+ if clearly stated, 0.7-0.8 if somewhat clear, 0.5-0.6 if ambiguous.

Output ONLY a JSON object:
{{
  "extracted_fields": {{
    "field_id": {{"value": "extracted value", "confidence": 0.9}},
    ...
  }}
}}
If nothing can be extracted, return: {{"extracted_fields": {{}}}}"""

    user_prompt = f"""=== FIELDS TO EXTRACT INTO ===
{fields_text}

=== RECENT CONVERSATION ===
{context_text}

=== PATIENT'S LATEST MESSAGE ===
{patient_message}

=== ALREADY KNOWN ===
{filled_summary}

Extract any field values from the patient's latest message."""

    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.1)
        extracted = result.get("extracted_fields", {})
        
        # Validate: only accept fields that are in our unfilled list
        valid_field_ids = {f["id"] for f in unfilled_fields}
        validated = {}
        for fid, entry in extracted.items():
            if fid in valid_field_ids and isinstance(entry, dict) and entry.get("value"):
                validated[fid] = entry
        
        logger.info(f"Extraction: {len(validated)} fields extracted from patient message")
        return validated

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return {}


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

    system_prompt = f"""You are a compassionate medical kiosk assistant conducting a clinical history interview.

{lang_rule}

{demo_str}
Chief Complaint: {chief_complaint}

YOUR TASK: Ask the patient about this specific clinical topic:
  Field: {field_id}
  Intent: {question_intent}
  Category: {category}
  {"⚠️ This is a RED FLAG safety question — ask it sensitively but clearly." if is_red_flag else ""}

CONVERSATION RULES:
1. Ask ONE question at a time — natural and conversational, NOT robotic.
2. If the patient just gave an answer, acknowledge it briefly before asking your next question.
3. Be warm and empathetic. Use simple language. No medical jargon.
4. Do NOT diagnose or suggest treatments. You are gathering information only.
5. Generate 3-6 contextually relevant suggested options the patient can tap.
6. Include a flexible option like "Something else" or "None of these".
7. Do NOT repeat any question the patient has already answered (check the conversation history and known information below).

OUTPUT FORMAT — Return ONLY a JSON object:
{{
  "spoken_text": "Your question in {language_name}",
  "suggested_options": [
    {{"label": "English label", "label_translated": "Label in {language_name}"}},
    ...
  ],
  "reasoning": "Brief internal reasoning (English, not shown to patient)"
}}"""

    user_prompt = f"""=== ALREADY KNOWN INFORMATION ===
{filled_summary}

=== CONVERSATION SO FAR ===
{context_text}

{"=== PATIENT'S LAST MESSAGE ===" + chr(10) + patient_message if patient_message else "This is the opening question. No patient message yet."}

Generate your question about: {question_intent}"""

    t0 = time.time()
    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.4)
        elapsed = time.time() - t0

        spoken_text = result.get("spoken_text", "")
        options = result.get("suggested_options", [])
        reasoning = result.get("reasoning", "")

        if not spoken_text:
            spoken_text = _fallback_question(question_intent, language_name)
        if not options:
            options = _fallback_options(language_name)

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
) -> ConversationResult:
    """Generate the opening chief complaint question."""
    language_name = LANGUAGE_NAMES.get(language, "English")

    name_str = f" {patient_name}" if patient_name else ""
    
    if language == "en-IN":
        lang_rule = "Respond in simple, clear English."
    else:
        lang_rule = f"You MUST respond ENTIRELY in {language_name} using native script. spoken_text and label_translated must be in {language_name}."

    system_prompt = f"""You are a compassionate medical kiosk assistant.
{lang_rule}

Generate a warm opening question to ask the patient what brings them here today.
{"Address them as" + name_str + "." if name_str else ""}

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
