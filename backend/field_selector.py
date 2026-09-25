"""
SwasthyaSync v4 — Field Selector (non-LLM)

A deterministic priority function that selects the next field to ask about.
No LLM calls — pure logic based on the dynamic schema and filled-state.

Selection order:
  1. critical + red_flag fields (patient safety first)
  2. critical non-red-flag fields
  3. high priority fields
  4. medium priority fields
  5. optional fields (only if time permits)

Skips any field whose `conditional_on` condition is not met.
"""

from __future__ import annotations
import logging
import re

logger = logging.getLogger(__name__)

# Priority ordering (lower number = ask first)
PRIORITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "optional": 3,
}


# Negative answer patterns — mirrors conversation_engine._is_negative_answer()
_NEGATIVE_VALUES = frozenset([
    "no", "nahi", "nah", "nope", "denied / none", "denied", "none",
    "not provided", "not applicable", "na", "n/a",
    "healthy", "normal", "fine", "none of these",
])


def _is_positive_value(actual: str) -> bool:
    """Return True when a stored value represents a positive / affirmative answer."""
    if not actual:
        return False
    a = actual.lower().strip().rstrip(".!,")
    if a in _NEGATIVE_VALUES:
        return False
    if a.startswith(("no ", "no,", "none ", "nahi ", "not ")):
        return False
    return True


def _is_condition_met(field: dict, filled_state: dict) -> bool:
    """
    Check if a field's conditional_on prerequisite is satisfied.
    Format: "field_id:value" or "field_id:!value" (negation).
    Special values: "yes" → any positive answer; "no" → any negative answer.
    If no condition, always True.
    """
    condition = field.get("conditional_on")
    if not condition:
        return True

    # Parse "field_id:expected_value" or "field_id:!excluded_value"
    parts = condition.split(":", 1)
    if len(parts) != 2:
        return True  # Malformed condition — don't block

    cond_field_id, expected = parts[0].strip(), parts[1].strip().lower()

    # Get the actual value
    entry = filled_state.get(cond_field_id, {})
    actual = str(entry.get("value", "")).lower().strip() if isinstance(entry, dict) else ""

    if not actual:
        return False  # Prerequisite field not yet filled — skip for now

    # ── Fork-aware semantic checks ──
    if expected == "yes":
        # Any positive (non-negative) answer counts as yes
        return _is_positive_value(actual)

    if expected == "no":
        # Any negative answer counts as no
        return not _is_positive_value(actual)

    # Negation check (field_id:!value)
    if expected.startswith("!"):
        return actual != expected[1:].strip()

    # Exact string match for all other conditions
    return actual == expected


def _sort_key(field: dict) -> tuple:
    """
    Sort key: (priority_order, not_red_flag, category_order)
    This ensures: critical+red_flag first, then critical, then high, etc.
    """
    priority = PRIORITY_ORDER.get(field.get("priority", "medium"), 2)
    is_red_flag = field.get("red_flag", False)
    
    # Within same priority, ask red-flag fields first
    # Within same priority+red_flag, prefer HPI over other categories
    category_order = {
        "HPI": 0,
        "red_flag_check": 1,
        "PMH": 2,
        "DH": 3,
        "FH": 4,
        "SH": 5,
        "ROS": 6,
    }
    cat = category_order.get(field.get("category", "HPI"), 7)
    
    return (priority, not is_red_flag, cat)


def next_field(schema: dict, filled_state: dict) -> dict | None:
    """
    Select the next field to ask about.
    
    Args:
        schema: The dynamic schema with a "fields" list
        filled_state: Current state {field_id: {value, confidence}}
    
    Returns:
        The field dict to ask about, or None if all relevant fields are filled.
    """
    fields = schema.get("fields", [])
    
    # Filter to unfilled fields with met conditions
    candidates = []
    for field in fields:
        field_id = field.get("id", "")
        
        # Skip if already filled
        entry = filled_state.get(field_id, {})
        if isinstance(entry, dict) and entry.get("value"):
            continue
        
        # Skip if condition not met
        if not _is_condition_met(field, filled_state):
            continue
        
        candidates.append(field)
    
    if not candidates:
        return None
    
    # Sort by priority
    candidates.sort(key=_sort_key)
    
    selected = candidates[0]
    logger.debug(
        f"Field selector: chose '{selected['id']}' "
        f"(priority={selected.get('priority')}, red_flag={selected.get('red_flag')}) "
        f"from {len(candidates)} candidates"
    )
    return selected


def is_fork_eligible(field: dict) -> bool:
    """Check if a field is tagged as fork_eligible (zero-cost dict lookup)."""
    return field.get("fork_eligible", False)


def get_unfilled_field_ids(schema: dict, filled_state: dict) -> list[str]:
    """Return IDs of all unfilled fields (for extraction scoping)."""
    fields = schema.get("fields", [])
    unfilled = []
    for field in fields:
        field_id = field.get("id", "")
        entry = filled_state.get(field_id, {})
        if not (isinstance(entry, dict) and entry.get("value")):
            unfilled.append(field_id)
    return unfilled


def _is_info_already_captured(field: dict, conversation_history: list) -> str | None:
    """
    B4 — Deduplication guard for fork children.
    Check if the information a field asks about was already mentioned by the patient
    in a previous turn. Uses simple keyword matching — no LLM, zero hallucination risk.

    Returns the matching patient message string if found, None otherwise.
    """
    intent = field.get("question_intent", "")
    if not intent:
        return None

    # Extract meaningful keywords from question_intent (words > 3 chars)
    raw_words = re.split(r"[\s,?.'\"!]+", intent.lower())
    stop_words = {"does", "your", "have", "been", "this", "that", "with", "from",
                  "into", "when", "what", "where", "which", "there", "their", "about",
                  "pain", "symptom", "patient", "please", "tell", "feel", "feeling"}
    keywords = [w for w in raw_words if len(w) > 3 and w not in stop_words]

    if not keywords:
        return None

    # Search patient messages in conversation history
    for msg in conversation_history:
        if msg.get("role") != "patient":
            continue
        content = msg.get("content", "").lower()
        if not content:
            continue
        # If at least 2 keywords match → info was already provided
        hits = sum(1 for kw in keywords if kw in content)
        if hits >= min(2, len(keywords)):
            return msg.get("content", "")

    return None


def get_progress(schema: dict, filled_state: dict) -> dict:
    """
    B5 — Calculate progress based on active critical + high priority fields.
    "Active" means: no conditional_on, OR conditional_on condition is already met.
    Fork children only count toward the total once their parent triggers them.
    This prevents the progress bar from going backwards when forks activate.
    Returns {done, total, percent, label}.
    """
    fields = schema.get("fields", [])

    # Only count critical + high fields whose conditions are currently met
    target_fields = [
        f for f in fields
        if f.get("priority") in ("critical", "high")
        and _is_condition_met(f, filled_state)
    ]
    total = len(target_fields)

    filled = 0
    for f in target_fields:
        entry = filled_state.get(f["id"], {})
        if isinstance(entry, dict) and entry.get("value"):
            filled += 1

    percent = int((filled / total * 100)) if total > 0 else 0
    return {
        "done": filled,
        "total": total,
        "percent": percent,
        "label": f"{filled}/{total} key items collected",
    }


def is_interview_complete(schema: dict, filled_state: dict, turn_count: int, max_turns: int | None = None) -> bool:
    """
    Check if the interview should end.
    True when:
    1. Max turns reached (default 7 for allopathic, 25 for AYUSH).
    2. All critical + high fields are filled.
    3. At least 5 key items are filled and turn_count >= 5 (allopathic).
    4. All critical fields are answered and turn_count >= 5 (allopathic).
    """
    fields = schema.get("fields", [])
    is_ayush = any(f.get("category") == "PRAKRITI" for f in fields)
    effective_max = max_turns if max_turns is not None else (25 if is_ayush else 30)

    if turn_count >= effective_max:
        logger.info(f"Interview ending: max turns ({effective_max}) reached")
        return True

    critical_high = [f for f in fields if f.get("priority") in ("critical", "high")]

    filled_count = sum(
        1 for f in critical_high
        if isinstance(filled_state.get(f["id"]), dict) and filled_state[f["id"]].get("value")
    )

    # All critical/high fields answered
    if critical_high and filled_count >= len(critical_high):
        logger.info(f"Interview ending: all {len(critical_high)} critical/high fields filled at turn {turn_count}")
        return True

    # High clinical coverage reached (for allopathic) — at least 12 fields filled and 12 turns done
    if not is_ayush and filled_count >= 12 and turn_count >= 12:
        logger.info(f"Interview ending: sufficient clinical coverage ({filled_count} fields) at turn {turn_count}")
        return True

    # All safety-critical fields answered and at least 15 turns (for allopathic)
    if not is_ayush:
        unfilled_critical = [
            f for f in fields
            if f.get("priority") == "critical"
            and not (isinstance(filled_state.get(f["id"]), dict) and filled_state[f["id"]].get("value"))
        ]
        if not unfilled_critical and turn_count >= 15:
            logger.info(f"Interview ending: all critical fields answered at turn {turn_count}")
            return True

    return False


def get_current_category_label(schema: dict, filled_state: dict) -> str:
    """
    Get a human-readable label for the current category being explored.
    Based on the next field's category.
    """
    field = next_field(schema, filled_state)
    if not field:
        return "Wrapping Up"
    
    category_labels = {
        "HPI": "Exploring Your Symptoms",
        "red_flag_check": "Important Safety Checks",
        "PMH": "Your Medical Background",
        "DH": "Medications & Allergies",
        "FH": "Family Health History",
        "SH": "Lifestyle & Habits",
        "ROS": "General Health Check",
    }
    return category_labels.get(field.get("category", "HPI"), "Gathering Information")
