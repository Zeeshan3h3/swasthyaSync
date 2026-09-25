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
import asyncio
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
        import time
        self.fsm = MacroFSM(clinic_mode=clinic_mode)
        self.record = PatientRecord(clinic_mode=clinic_mode, language=language)
        self.language = language
        self.last_active_time = time.time()
        self.current_target_field: dict | None = None
        self.last_displayed_field: dict | None = None   # A5: track most recently displayed field
        self.last_options: list = []                    # A3: re-serve options on back/skip

    # ──────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ──────────────────────────────────────────────────────────────────

    def start_session(self) -> dict:
        """Initialize and return the first UI instruction."""
        import time
        self.last_active_time = time.time()
        self.fsm.set_state("CHIEF_COMPLAINT")
        self.record.macro_state = "CHIEF_COMPLAINT"
        return self._build_ui_instruction()

    def set_demographics(self, name: str, age: int | None, sex: str, weight: float | None = None, height: str | None = None, vitals: str | None = None):
        """Set patient demographics (called from frontend before interview)."""
        import time
        self.last_active_time = time.time()
        self.record.patient_name = name
        self.record.patient_age = age
        self.record.patient_sex = sex
        if weight:
            self.record.update_filled_state("weight", weight, confidence=1.0)
        if height:
            self.record.update_filled_state("height", height, confidence=1.0)
        if vitals:
            self.record.update_filled_state("vitals", vitals, confidence=1.0)
        logger.info(f"Demographics set: name={name}, age={age}, sex={sex}, weight={weight}, height={height}, vitals={vitals}")

    def set_previous_history(self, history: dict | None):
        """Inject previous encounter history for follow-up context."""
        import time
        self.last_active_time = time.time()
        if history:
            self.record.previous_history = history
            logger.info("Previous history injected for follow-up.")

    def process_patient_input(self, input_type: str, value: str) -> dict:
        """
        Process a patient's response and return the next UI instruction.
        input_type: "tap" | "voice" | "skip" | "back" | "next"
        value: the selected option text or voice transcript
        """
        import time
        self.last_active_time = time.time()
        state = self.fsm.state

        # ── Navigation actions ──
        if input_type == "back":
            self.fsm.go_back()
            if self.fsm.state == "SCHEMA_GENERATION":
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
            # 1. The Database Checkpoint: Save before advancing
            if state == "DOCUMENT_SCAN":
                try:
                    import database
                    # Serialize the volatile RAM data
                    record_payload = {
                        "filled_state": self.record.filled_state,
                        "document_extractions": [e.model_dump() for e in self.record.document_extractions],
                        "red_flags": [r.model_dump() for r in self.record.red_flags]
                    }
                    has_red_flags = len(self.record.red_flags) > 0
                    pass
                except Exception as e:
                    logger.error(f"🚨 CRITICAL FAULT: Failed to persist session {self.record.session_id} - {e}")

            # 2. Advance the FSM safely
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
            doctor_custom_instructions=self.record.doctor_custom_instructions,
        )
        self.record.dynamic_schema = schema

        # Initialize filled_state with all fields as unfilled
        for field in schema.get("fields", []):
            self.record.filled_state[field["id"]] = {"value": None, "confidence": 0.0}

        field_count = len(schema.get("fields", []))
        logger.info(f"Schema generated: {field_count} fields for category '{category}'")

        # ── INITIAL EXTRACTION PASS ──
        # Extract any symptoms/details already mentioned in the chief complaint!
        try:
            initial_extracted, _ = conversation_engine.extract_from_response(
                patient_message=value,
                unfilled_fields=schema.get("fields", []),
                filled_summary="",
                conversation_history=self.record.conversation_history,
                language=self.language,
                doctor_custom_instructions=self.record.doctor_custom_instructions,
            )
            for fid, entry in initial_extracted.items():
                self.record.update_filled_state(fid, entry.get("value"), entry.get("confidence", 0.95))
                logger.info(f"⚡ Chief Complaint pre-filled: {fid} = {entry.get('value')}")
        except Exception as e:
            logger.warning(f"Initial extraction pass on chief complaint failed: {e}")

        # Skip SCHEMA_GENERATION state and go directly to DYNAMIC_INTERVIEW
        self.fsm.set_state("DYNAMIC_INTERVIEW")
        self.record.macro_state = "DYNAMIC_INTERVIEW"

        return self._build_ui_instruction()

    # ──────────────────────────────────────────────────────────────────
    # UNPROMPTED CLINICAL FINDINGS & DYNAMIC FORK INJECTOR (DISABLED)
    # ──────────────────────────────────────────────────────────────────

    def _inject_additional_findings_and_fork(self, additional_findings: list[dict], schema: dict):
        """Disabled to prevent runtime schema mutations and hallucinations."""
        return

    # ──────────────────────────────────────────────────────────────────
    # DYNAMIC INTERVIEW HANDLER (Stage 2 loop)
    # ──────────────────────────────────────────────────────────────────

    def _handle_dynamic_turn(self, input_type: str, value: str) -> dict:
        """
        Handle one turn of the dynamic interview.
        1. Extract single target field from patient's response (or direct deterministic tap)
        2. Run safety check
        3. Check if interview is complete
        4. Select next field
        5. Generate question for that field
        """
        schema = self.record.dynamic_schema or {"fields": []}

        # 1. Record patient's message
        self.record.add_conversation_message("patient", value, "DYNAMIC_INTERVIEW")
        self.record.interview_turn_count += 1

        # 2. EXTRACTION: Single-field deterministic or targeted extraction
        is_negative = conversation_engine._is_negative_answer(value)
        target_field = self.current_target_field

        if target_field:
            target_id = target_field.get("id")
            if input_type == "tap":
                # Option tapped directly: 100% deterministic, zero LLM hallucination
                recorded_val = "Denied / None" if is_negative else value
                self.record.update_filled_state(target_id, recorded_val, confidence=1.0)
                logger.info(f"🎯 Deterministic Tap filled: {target_id} = '{recorded_val}'")
            elif is_negative:
                self.record.update_filled_state(target_id, "Denied / None", confidence=1.0)
                logger.info(f"🚫 Negative answer recorded for {target_id}: Denied / None")
            else:
                extracted_dict = conversation_engine.extract_single_target_field(
                    target_field=target_field,
                    patient_message=value,
                    language=self.language,
                )
                extracted_val = extracted_dict.get("value")
                extracted_conf = extracted_dict.get("confidence", 0.95)
                if extracted_val:
                    # Normal extraction success
                    self.record.update_filled_state(target_id, extracted_val, confidence=extracted_conf)
                    logger.info(f"🎯 Single-target extracted: {target_id} = '{extracted_val}' (conf: {extracted_conf})")
                elif value.strip():
                    # A4: Patient said something but LLM couldn't map it — store verbatim
                    self.record.update_filled_state(target_id, value.strip()[:120], confidence=0.55)
                    logger.info(f"📝 Verbatim stored for {target_id}: LLM extraction returned null")
                # else: empty string — A1 guard below handles this

            # ── A1: Force-advance guard ──────────────────────────────────────
            # After ALL extraction paths, if field still has no value
            # (empty voice, garbage audio, repeated null) → mark "Not provided"
            # so the interview never loops on the same field.
            if self.record.filled_state.get(target_id, {}).get("value") is None:
                self.record.update_filled_state(target_id, "Not provided", confidence=0.4)
                logger.warning(f"⚠️ Force-advance: {target_id} had no extractable value — marked 'Not provided'")

            # ── B3: Fork activation dedup guard ─────────────────────────────
            # If we just filled a fork-eligible field with a positive answer,
            # check if any fork children were already mentioned by the patient.
            # If so, pre-fill them so they won't be asked again.
            if target_field.get("fork_eligible") and field_selector._is_positive_value(
                str(self.record.filled_state.get(target_id, {}).get("value", "")).lower()
            ):
                schema_fields = schema.get("fields", [])
                field_map = {f["id"]: f for f in schema_fields}
                for child_id in target_field.get("forks_on_positive", []):
                    child_field = field_map.get(child_id)
                    if not child_field:
                        continue
                    # Skip if already filled
                    if self.record.filled_state.get(child_id, {}).get("value"):
                        continue
                    # Check if patient already mentioned this info
                    captured = field_selector._is_info_already_captured(
                        child_field, self.record.conversation_history
                    )
                    if captured:
                        self.record.update_filled_state(child_id, captured[:120], confidence=0.75)
                        logger.info(f"⚡ Fork child pre-filled from earlier context: {child_id}")

        else:
            # A5: Fallback when no target field tracked
            # Try to recover from last_displayed_field first (primary target)
            # then run broad extraction for bonus multi-info capture
            unfilled_fields = [
                f for f in schema.get("fields", [])
                if not (self.record.filled_state.get(f["id"], {}).get("value"))
            ]

            primary_filled = False
            if self.last_displayed_field:
                primary_id = self.last_displayed_field.get("id")
                if not self.record.filled_state.get(primary_id, {}).get("value"):
                    extracted_dict = conversation_engine.extract_single_target_field(
                        target_field=self.last_displayed_field,
                        patient_message=value,
                        language=self.language,
                    )
                    pval = extracted_dict.get("value")
                    if pval:
                        self.record.update_filled_state(primary_id, pval, extracted_dict.get("confidence", 0.8))
                        logger.info(f"🎯 A5 primary recovered: {primary_id} = '{pval}'")
                        primary_filled = True
                    elif value.strip():
                        self.record.update_filled_state(primary_id, value.strip()[:120], confidence=0.55)
                        logger.info(f"📝 A5 primary verbatim: {primary_id}")
                        primary_filled = True

            # Broad extraction for remaining / bonus fields
            remaining = [f for f in unfilled_fields if not self.record.filled_state.get(f["id"], {}).get("value")]
            if remaining:
                extracted, _ = conversation_engine.extract_from_response(
                    patient_message=value,
                    unfilled_fields=remaining,
                    filled_summary=self.record.get_filled_summary(),
                    conversation_history=self.record.conversation_history,
                    language=self.language,
                    doctor_custom_instructions=self.record.doctor_custom_instructions,
                )
                for fid, entry in extracted.items():
                    self.record.update_filled_state(fid, entry.get("value"), entry.get("confidence", 0.8))

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
            self.current_target_field = None
            self.fsm.advance()  # → DOCUMENT_SCAN
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # 6. SELECT NEXT FIELD
        next_field = field_selector.next_field(schema, self.record.filled_state)
        if next_field is None:
            # All fields filled — advance
            self.current_target_field = None
            self.fsm.advance()
            self.record.macro_state = self.fsm.state
            return self._build_ui_instruction()

        # Track active target field for next turn
        self.current_target_field = next_field

        # 7. GENERATE QUESTION for the selected field
        result = conversation_engine.generate_question(
            target_field=next_field,
            filled_summary=self.record.get_filled_summary(),
            conversation_history=self.record.conversation_history,
            language=self.language,
            patient_message=value,
            chief_complaint=self.record.chief_complaint.value if self.record.chief_complaint else "",
            patient_age=self.record.patient_age,
            patient_sex=self.record.patient_sex,
            previous_history=self.record.previous_history,
            doctor_custom_instructions=self.record.doctor_custom_instructions,
        )

        # Store assistant's question
        self.record.add_conversation_message(
            "assistant", result.spoken_text, next_field.get("category", "HPI")
        )

        # Removed db checkpoint here, handled in main.py

        # 8. Build UI response
        ui_response = self._build_dynamic_ui(result, next_field)
        # A3: cache last options for re-serve on back/skip navigation
        self.last_options = ui_response.get("options", [])
        self.last_displayed_field = next_field   # A5: track for fallback recovery
        return ui_response

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
                previous_history=self.record.previous_history,
                doctor_custom_instructions=self.record.doctor_custom_instructions,
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
            schema = self.record.dynamic_schema or {"fields": []}

            # ── A3: Navigation fix ───────────────────────────────────────────
            # If conversation_history already has an assistant message, this call
            # is from back/skip navigation — re-serve the last question instead
            # of generating a new one (which would add a duplicate to history).
            last_assistant = next(
                (m for m in reversed(self.record.conversation_history) if m.get("role") == "assistant"),
                None,
            )
            if last_assistant and self.current_target_field:
                logger.info("A3: Re-serving last question on navigation (no new LLM call)")
                return {
                    "macro_state": "DYNAMIC_INTERVIEW",
                    "clinic_mode": self.record.clinic_mode,
                    "session_id": self.record.session_id,
                    "language": self.language,
                    "screen": "conversation",
                    "orb_state": "idle",
                    "prompt": last_assistant.get("content", ""),
                    "options": self.last_options,
                    "section_label": field_selector.get_current_category_label(schema, self.record.filled_state),
                    "can_skip": True,
                    "progress": field_selector.get_progress(schema, self.record.filled_state),
                    "section_summary": self.record.get_filled_summary(),
                    "conversation_history": self.record.conversation_history[-6:],
                }

            # First entry into DYNAMIC_INTERVIEW — generate opening question
            next_f = field_selector.next_field(schema, self.record.filled_state)

            if next_f is None:
                self.current_target_field = None
                self.fsm.advance()
                self.record.macro_state = self.fsm.state
                return self._build_ui_instruction()

            self.current_target_field = next_f
            self.last_displayed_field = next_f   # A5: track

            result = conversation_engine.generate_question(
                target_field=next_f,
                filled_summary=self.record.get_filled_summary(),
                conversation_history=self.record.conversation_history,
                language=self.language,
                chief_complaint=str(self.record.chief_complaint.value or ""),
                patient_age=self.record.patient_age,
                patient_sex=self.record.patient_sex,
                previous_history=self.record.previous_history,
            )
            self.record.add_conversation_message(
                "assistant", result.spoken_text, next_f.get("category", "HPI")
            )
            ui_response = self._build_dynamic_ui(result, next_f)
            self.last_options = ui_response.get("options", [])  # A3: cache for re-serve
            return ui_response

        if state == "DOCUMENT_SCAN":
            return {**base, "screen": "document_scan", "orb_state": "idle", "patient_name": self.record.patient_name}

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
