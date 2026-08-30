"""
SwasthyaSync v4 — Dialogue Manager (Dynamic Schema-Driven)

Orchestrates the Two-Stage LLM Pipeline:
  Stage 1: After chief complaint → generate dynamic schema (once)
  Stage 2: Per turn → extract fields + generate next question (loop)

The Dialogue Manager:
  - Manages the simplified macro-FSM
  - Manages demographics collection
  - Calls schema_generator once after chief complaint
  - Runs the extract → select → question loop per turn
  - Runs the safety watchdog after every state update
  - Handles navigation (back, skip)
"""

from __future__ import annotations
import logging

from macro_fsm import MacroFSM
from patient_record import PatientRecord, SlotValue, RedFlagEntry
import conversation_engine
import llm_client
import schema_generator
import field_selector
from red_flag_library import check_safety

logger = logging.getLogger(__name__)


class DialogueManager:
    """
    Orchestrates a single patient session with dynamic schema-driven interview.
    """

    def __init__(self, clinic_mode: str = "allopathic", language: str = "en-IN"):
        self.fsm = MacroFSM(clinic_mode=clinic_mode)
        self.record = PatientRecord(clinic_mode=clinic_mode, language=language)
        self.language = language

    # ──────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ──────────────────────────────────────────────────────────────────

    def start_session(self) -> dict:
        """Initialize and return the first UI instruction."""
        self.fsm.set_state("CHIEF_COMPLAINT")
        self.record.macro_state = "CHIEF_COMPLAINT"
        return self._build_ui_instruction()

    def set_demographics(self, name: str, age: int | None, sex: str):
        """Set patient demographics (called from frontend before interview)."""
        self.record.patient_name = name
        self.record.patient_age = age
        self.record.patient_sex = sex
        logger.info(f"Demographics set: name={name}, age={age}, sex={sex}")

    def process_patient_input(self, input_type: str, value: str) -> dict:
        """
        Process a patient's response and return the next UI instruction.
        input_type: "tap" | "voice" | "skip" | "back" | "next"
        value: the selected option text or voice transcript
        """
        state = self.fsm.state

        # ── Navigation actions ──
        if input_type == "back":
            self.fsm.go_back()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        if input_type == "skip":
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # ── INIT: advance to demographics ──
        if state == "INIT":
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # ── DEMOGRAPHICS: advance to chief complaint ──
        if state == "DEMOGRAPHICS":
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # ── CHIEF_COMPLAINT: capture + classify + generate schema ──
        if state == "CHIEF_COMPLAINT":
            return self._handle_chief_complaint(value)

        # ── SCHEMA_GENERATION: should auto-advance (schema already generated) ──
        if state == "SCHEMA_GENERATION":
            self.fsm.advance()  # → DYNAMIC_INTERVIEW
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # ── DYNAMIC_INTERVIEW: the main loop ──
        if state == "DYNAMIC_INTERVIEW":
            return self._handle_dynamic_turn(input_type, value)

        # ── DOCUMENT_SCAN / SUMMARY_CONFIRMATION: advance on next ──
        if state in ("DOCUMENT_SCAN", "SUMMARY_CONFIRMATION"):
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # Fallback
        return self._build_ui_instruction()

    def resume_session(self) -> dict:
        """Re-construct the UI state for the current step without side-effects."""
        state = self.fsm.state
        if state == "DYNAMIC_INTERVIEW":
            # Find the last assistant message
            last_msg = None
            for msg in reversed(self.record.conversation_history):
                if msg["role"] == "assistant":
                    last_msg = msg["content"]
                    break
            
            import field_selector
            schema = self.record.dynamic_schema or {"fields": []}
            progress = field_selector.get_progress(schema, self.record.filled_state)
            category_label = field_selector.get_current_category_label(schema, self.record.filled_state)
            
            return {
                "macro_state": "DYNAMIC_INTERVIEW",
                "clinic_mode": self.record.clinic_mode,
                "session_id": self.record.session_id,
                "language": self.language,
                "screen": "conversation",
                "orb_state": "idle",
                "prompt": last_msg or "Let's continue.",
                "options": [], 
                "section_label": category_label,
                "can_skip": True,
                "progress": progress,
                "section_summary": self.record.get_filled_summary(),
                "conversation_history": self.record.conversation_history[-6:],
            }
        elif state == "CHIEF_COMPLAINT":
            last_msg = None
            for msg in reversed(self.record.conversation_history):
                if msg["role"] == "assistant":
                    last_msg = msg["content"]
                    break
            return {
                "macro_state": state,
                "clinic_mode": self.record.clinic_mode,
                "session_id": self.record.session_id,
                "language": self.language,
                "screen": "conversation",
                "orb_state": "idle",
                "prompt": last_msg or "What brings you in today?",
                "options": [],
                "section_label": "Chief Complaint",
                "can_skip": False,
                "progress": {"done": 0, "total": 1, "percent": 0, "label": "Getting started"},
                "section_summary": "",
                "conversation_history": [],
            }
        else:
            return self._build_ui_instruction()

    def process_redflag(self) -> dict:
        self.fsm.trigger_redflag()
        self.record.macro_state = self.fsm.state
        return self._build_ui_instruction()

    def clear_redflag(self) -> dict:
        self.fsm.resolve_interrupt()
        self.record.macro_state = self.fsm.state
        return self._build_ui_instruction()

    def get_record(self) -> dict:
        return self.record.model_dump()

    # ──────────────────────────────────────────────────────────────────
    # CHIEF COMPLAINT HANDLER
    # ──────────────────────────────────────────────────────────────────

    def _handle_chief_complaint(self, value: str) -> dict:
        """Capture chief complaint → classify → generate schema → advance."""
        # Store chief complaint
        self.record.chief_complaint = SlotValue(
            value=value, confidence=0.95, source="direct"
        )
        self.record.add_conversation_message("patient", value, "CHIEF_COMPLAINT")

        # Classify
        category = llm_client.classify_complaint(value, self.language)
        self.record.complaint_category = category
        logger.info(f"Chief complaint classified: '{value}' → {category}")

        # Generate dynamic schema (Stage 1)
        logger.info("Starting Stage 1: dynamic schema generation...")
        schema = schema_generator.generate_schema(
            chief_complaint=value,
            patient_age=self.record.patient_age,
            patient_sex=self.record.patient_sex,
            category=category,
        )
        self.record.dynamic_schema = schema

        # Initialize filled_state with all fields as unfilled
        for field in schema.get("fields", []):
            self.record.filled_state[field["id"]] = {"value": None, "confidence": 0.0}

        field_count = len(schema.get("fields", []))
        logger.info(f"Schema generated: {field_count} fields for category '{category}'")

        # Skip SCHEMA_GENERATION state and go directly to DYNAMIC_INTERVIEW
        self.fsm.set_state("DYNAMIC_INTERVIEW")
        self.record.macro_state = "DYNAMIC_INTERVIEW"

        return self._build_ui_instruction()

    # ──────────────────────────────────────────────────────────────────
    # DYNAMIC INTERVIEW HANDLER (Stage 2 loop)
    # ──────────────────────────────────────────────────────────────────

    def _handle_dynamic_turn(self, input_type: str, value: str) -> dict:
        """
        Handle one turn of the dynamic interview.
        1. Extract fields from patient's message
        2. Run safety check
        3. Check if interview is complete
        4. Select next field
        5. Generate question for that field
        """
        schema = self.record.dynamic_schema or {"fields": []}

        # 1. Record patient's message
        self.record.add_conversation_message("patient", value, "DYNAMIC_INTERVIEW")
        self.record.interview_turn_count += 1

        # 2. EXTRACTION: get field values from patient's response
        unfilled_fields = [
            f for f in schema.get("fields", [])
            if not (self.record.filled_state.get(f["id"], {}).get("value"))
        ]

        extracted = conversation_engine.extract_from_response(
            patient_message=value,
            unfilled_fields=unfilled_fields,
            filled_summary=self.record.get_filled_summary(),
            conversation_history=self.record.conversation_history,
            language=self.language,
        )

        # 3. Update filled_state with extracted data
        for fid, entry in extracted.items():
            self.record.update_filled_state(
                fid,
                entry.get("value"),
                entry.get("confidence", 0.8),
            )
            logger.debug(f"Filled: {fid} = {entry.get('value')}")

        # 4. SAFETY CHECK: run deterministic rules
        safety_flags = check_safety(self.record.filled_state)
        if safety_flags:
            existing_ids = {f.rule_id for f in self.record.red_flags}
            new_flags = [f for f in safety_flags if f.rule_id not in existing_ids]
            if new_flags:
                self.record.red_flags.extend(new_flags)
                self.fsm.trigger_redflag()
                self.record.macro_state = self.fsm.state
                return self._build_ui_instruction(red_flags=new_flags)

        # 5. CHECK COMPLETION
        if field_selector.is_interview_complete(
            schema, self.record.filled_state, self.record.interview_turn_count
        ):
            logger.info(f"Interview complete at turn {self.record.interview_turn_count}")
            self.fsm.advance()  # → DOCUMENT_SCAN
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # 6. SELECT NEXT FIELD
        next_field = field_selector.next_field(schema, self.record.filled_state)
        if next_field is None:
            # All fields filled — advance
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # 7. GENERATE QUESTION for the selected field
        result = conversation_engine.generate_question(
            target_field=next_field,
            filled_summary=self.record.get_filled_summary(),
            conversation_history=self.record.conversation_history,
            language=self.language,
            patient_message=value,
            chief_complaint=str(self.record.chief_complaint.value or ""),
            patient_age=self.record.patient_age,
            patient_sex=self.record.patient_sex,
        )

        # Store assistant's question
        self.record.add_conversation_message(
            "assistant", result.spoken_text, next_field.get("category", "HPI")
        )

        # 8. Build UI response
        return self._build_dynamic_ui(result, next_field)

    # ──────────────────────────────────────────────────────────────────
    # UI INSTRUCTION BUILDER
    # ──────────────────────────────────────────────────────────────────

    def _build_dynamic_ui(
        self,
        result: conversation_engine.ConversationResult,
        current_field: dict | None = None,
    ) -> dict:
        """Build UI instruction for the dynamic interview."""
        schema = self.record.dynamic_schema or {"fields": []}
        progress = field_selector.get_progress(schema, self.record.filled_state)
        category_label = field_selector.get_current_category_label(schema, self.record.filled_state)

        options_out = []
        for opt in result.suggested_options:
            options_out.append({
                "label": opt.get("label_translated", opt.get("label", "")),
                "value": opt.get("label", ""),
                "icon": None,
            })

        return {
            "macro_state": "DYNAMIC_INTERVIEW",
            "clinic_mode": self.record.clinic_mode,
            "session_id": self.record.session_id,
            "language": self.language,
            "screen": "conversation",
            "orb_state": "idle",
            "prompt": result.spoken_text,
            "options": options_out,
            "section_label": category_label,
            "can_skip": True,
            "progress": progress,
            "section_summary": self.record.get_filled_summary(),
            "conversation_history": self.record.conversation_history[-6:],
        }

    def _build_ui_instruction(
        self,
        red_flags: list | None = None,
    ) -> dict:
        """Build the UI instruction dict for the frontend."""
        state = self.fsm.state

        base = {
            "macro_state": state,
            "clinic_mode": self.record.clinic_mode,
            "session_id": self.record.session_id,
            "language": self.language,
        }

        # ── Interrupt states ──
        if state == "EMERGENCY_PROTOCOL":
            flag_data = red_flags or self.record.red_flags
            return {
                **base,
                "screen": "triage_alert",
                "orb_state": "alert",
                "red_flags": [
                    {"rule_id": f.rule_id, "description": f.description}
                    for f in (flag_data if flag_data else [])
                ],
            }

        if state == "STAFF_ASSIST":
            return {**base, "screen": "staff_assist", "orb_state": "idle"}

        # ── Non-conversational states ──
        if state == "INIT":
            return {**base, "screen": "welcome", "orb_state": "idle"}

        if state == "DEMOGRAPHICS":
            return {**base, "screen": "demographics", "orb_state": "idle"}

        if state == "CHIEF_COMPLAINT":
            # Generate opening question
            result = conversation_engine.generate_opening_question(
                language=self.language,
                patient_name=self.record.patient_name,
                patient_age=self.record.patient_age,
                patient_sex=self.record.patient_sex,
            )
            self.record.add_conversation_message(
                "assistant", result.spoken_text, "CHIEF_COMPLAINT"
            )

            options_out = []
            for opt in result.suggested_options:
                options_out.append({
                    "label": opt.get("label_translated", opt.get("label", "")),
                    "value": opt.get("label", ""),
                    "icon": None,
                })

            return {
                **base,
                "screen": "conversation",
                "orb_state": "idle",
                "prompt": result.spoken_text,
                "options": options_out,
                "section_label": "Chief Complaint",
                "can_skip": False,
                "progress": {"done": 0, "total": 1, "percent": 0, "label": "Getting started"},
                "section_summary": "",
                "conversation_history": [],
            }

        if state == "SCHEMA_GENERATION":
            return {
                **base,
                "screen": "schema_generating",
                "orb_state": "processing",
            }

        if state == "DYNAMIC_INTERVIEW":
            # Generate first question for the dynamic interview
            schema = self.record.dynamic_schema or {"fields": []}
            next_f = field_selector.next_field(schema, self.record.filled_state)

            if next_f is None:
                self.fsm.advance()
                self.record.macro_state = self.fsm.state
                return self._build_ui_instruction()

            result = conversation_engine.generate_question(
                target_field=next_f,
                filled_summary=self.record.get_filled_summary(),
                conversation_history=self.record.conversation_history,
                language=self.language,
                chief_complaint=str(self.record.chief_complaint.value or ""),
                patient_age=self.record.patient_age,
                patient_sex=self.record.patient_sex,
            )
            self.record.add_conversation_message(
                "assistant", result.spoken_text, next_f.get("category", "HPI")
            )

            return self._build_dynamic_ui(result, next_f)

        if state == "DOCUMENT_SCAN":
            return {**base, "screen": "document_scan", "orb_state": "idle"}

        if state == "SUMMARY_CONFIRMATION":
            return {
                **base,
                "screen": "summary",
                "orb_state": "success",
                "patient_record": self.record.model_dump(),
            }

        if state == "COMPLETE":
            return {
                **base,
                "screen": "complete",
                "orb_state": "success",
                "patient_record": self.record.model_dump(),
            }

        # Fallback
        return {**base, "screen": "unknown", "orb_state": "idle"}
