import os
import json
import re
import time
import logging
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-2.0-flash"

_client_instance = None

def _get_client():
    global _client_instance
    if not GEMINI_API_KEY:
        return None
    if _client_instance is None:
        _client_instance = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized (singleton)")
    return _client_instance

def generate_portal_chat_structured(system_prompt: str, user_prompt: str, temperature: float = 0.4) -> dict:
    """
    Generates structured JSON response conforming to the SwasthyaSync AI specification.
    Returns a dict with: intent, response, sources, confidence, needs_clinician, emergency, suggested_followups.
    """
    client = _get_client()
    if not client:
        return {
            "intent": "UNKNOWN",
            "response": "I'm sorry, my AI systems are currently offline. Please try again later.",
            "sources": [],
            "confidence": "low",
            "needs_clinician": False,
            "emergency": False,
            "suggested_followups": []
        }
        
    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL, "gemini-1.5-flash"]
    last_exception = None

    for model in models_to_try:
        for attempt in range(2):
            try:
                config = genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=temperature,
                    max_output_tokens=768,
                )
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )
                
                raw_text = response.text.strip()
                # Clean any markdown codeblocks if accidentally returned
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()
                
                parsed = json.loads(raw_text)
                if isinstance(parsed, dict) and "response" in parsed:
                    if "sources" not in parsed: parsed["sources"] = []
                    if "suggested_followups" not in parsed: parsed["suggested_followups"] = []
                    return parsed
                elif isinstance(parsed, dict) and "reply" in parsed:
                    parsed["response"] = parsed["reply"]
                    return parsed
                    
            except Exception as e:
                last_exception = e
                err_msg = str(e)
                logger.warning(f"Attempt {attempt+1} on {model} failed: {err_msg}")
                if "503" in err_msg or "UNAVAILABLE" in err_msg or "NOT_FOUND" in err_msg:
                    break
                if attempt < 1:
                    time.sleep(0.5)

    # Fallback to plain text generation if JSON mode encounters issues
    try:
        plain_config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=512,
        )
        plain_res = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=user_prompt,
            config=plain_config
        )
        if plain_res and plain_res.text:
            return {
                "intent": "GENERAL_HEALTH",
                "response": plain_res.text.strip(),
                "sources": [],
                "confidence": "medium",
                "needs_clinician": False,
                "emergency": False,
                "suggested_followups": []
            }
    except Exception as fallback_err:
        logger.error(f"Fallback plain generation failed: {fallback_err}")

    logger.error(f"Gemini structured generation failed: {last_exception}")
    return {
        "intent": "UNKNOWN",
        "response": "I apologize, but I encountered an issue processing your medical question. Please speak directly with your doctor or clinical staff.",
        "sources": [],
        "confidence": "low",
        "needs_clinician": True,
        "emergency": False,
        "suggested_followups": []
    }

def generate_portal_chat_reply(system_prompt: str, user_prompt: str, temperature: float = 0.5) -> str:
    """Backward-compatible text generation wrapper."""
    result = generate_portal_chat_structured(system_prompt, user_prompt, temperature)
    return result.get("response", "")
