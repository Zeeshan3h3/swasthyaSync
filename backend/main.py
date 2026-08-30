"""
SwasthyaSync — FastAPI Backend Server (Optimized)

Changes:
  - STT/TTS endpoints are now truly async (run blocking I/O in thread pool)
  - WebSocket handler times each step to identify bottlenecks
  - Added logging for every major operation

Endpoints:
  WebSocket /ws/session  — real-time conversation loop
  POST     /api/session   — create a new session
  POST     /api/ocr       — upload and process a document image
  GET      /api/record/{session_id} — get the patient record
  POST     /api/stt       — speech to text
  POST     /api/tts       — text to speech
"""

from __future__ import annotations
import json
import logging
import time
import asyncio
from contextlib import asynccontextmanager
from typing import List
from dotenv import load_dotenv

load_dotenv()  # Load .env before anything else

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("uploads", exist_ok=True)

from dialogue_manager import DialogueManager
from ocr_pipeline import process_document
import sarvam_client
from routes_extended import extended_router, set_sessions_ref, escalate_queue_priority

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# In-memory session store (for hackathon; would be Redis/DB in production)
sessions: dict[str, DialogueManager] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwasthyaSync backend starting...")
    yield
    logger.info("SwasthyaSync backend shutting down.")


app = FastAPI(
    title="SwasthyaSync API",
    description="AI-powered clinical history-taking engine",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extended_router)
set_sessions_ref(sessions)  # Bridge: let routes_extended read live PatientRecord data

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ──────────────────────────────────────────────────────────────────────
# REST Endpoints
# ──────────────────────────────────────────────────────────────────────

@app.post("/api/session")
async def create_session(
    clinic_mode: str = "allopathic",
    language: str = "en-IN",
):
    """Create a new patient session and return the initial UI state."""
    dm = DialogueManager(clinic_mode=clinic_mode, language=language)
    ui = dm.start_session()
    session_id = dm.record.session_id
    sessions[session_id] = dm
    return {"session_id": session_id, "ui": ui}


@app.get("/api/record/{session_id}")
async def get_record(session_id: str):
    """Get the full patient record for a session."""
    dm = sessions.get(session_id)
    if not dm:
        return {"error": "Session not found"}
    return dm.get_record()


@app.post("/api/ocr")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(""),
):
    """Upload a document image for OCR processing."""
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    
    # Save the file locally so we can display it later
    import uuid
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename or 'doc.jpg'}"
    file_path = os.path.join("uploads", safe_filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    result = await process_document(image_bytes, filename=file.filename or "doc.jpg", media_type=content_type)
    result["image_url"] = f"http://localhost:8000/uploads/{safe_filename}"

    # If we have a session, merge OCR entities into the patient record
    if session_id and session_id in sessions:
        dm = sessions[session_id]
        from patient_record import DocumentExtraction
        doc_ext = DocumentExtraction(
            doc_id=result.get("doc_id", "unknown"),
            doc_type=result.get("document_type", "unknown"),
            ocr_path=result["image_url"], # store image url here
            entities=[result],
        )
        dm.record.document_extractions.append(doc_ext)
        
        # Pre-calculate unverifiable values so they can be shown in Screen 6
        from document_red_flags import check_document_flags
        check_document_flags([doc_ext.model_dump()], dm.record)

    return result

@app.post("/api/ocr/batch")
async def upload_document_batch(
    files: List[UploadFile] = File(...),
    session_id: str = Form(""),
):
    """Upload multiple document images for batch OCR processing."""
    async def process_single_file(file: UploadFile):
        image_bytes = await file.read()
        content_type = file.content_type or "image/jpeg"
        return await process_document(image_bytes, filename=file.filename or "doc.jpg", media_type=content_type)
        
    tasks = [process_single_file(f) for f in files]
    results = await asyncio.gather(*tasks)
    
    if session_id and session_id in sessions:
        dm = sessions[session_id]
        from patient_record import DocumentExtraction
        for res in results:
            doc_ext = DocumentExtraction(
                doc_id=res.get("doc_id", "unknown"),
                doc_type=res.get("document_type", "unknown"),
                ocr_path="vision_ai",
                entities=[res],
            )
            dm.record.document_extractions.append(doc_ext)
            
        # Pre-calculate unverifiable values so they can be shown in Screen 6
        from document_red_flags import check_document_flags
        doc_extractions_raw = [ext.model_dump() for ext in dm.record.document_extractions]
        check_document_flags(doc_extractions_raw, dm.record)

    return {"status": "success", "results": results}

@app.get("/api/record/{session_id}/timeline")
async def get_patient_timeline(session_id: str):
    """Get a chronologically sorted timeline of patient documents with red flags."""
    dm = sessions.get(session_id)
    if not dm:
        return {"error": "Session not found"}
        
    from datetime import datetime
    
    docs = []
    for ext in dm.record.document_extractions:
        for ent in ext.entities:
            docs.append(ent)
            
    def parse_sort_date(doc: dict):
        issue_date = doc.get("issue_date")
        if not issue_date:
            return datetime.max
        try:
            return datetime.strptime(issue_date, "%Y-%m-%d")
        except ValueError:
            return datetime.max

    sorted_docs = sorted(docs, key=parse_sort_date)

    red_flags = []
    for doc in sorted_docs:
        for lab in doc.get("lab_values", []):
            if lab.get("is_abnormal"):
                test_name = lab.get("test_name", "Unknown Test")
                val = lab.get("value", "")
                unit = lab.get("unit", "")
                reason = lab.get("flag_reason", "Abnormal")
                red_flags.append(f"{test_name}: {val} {unit} — {reason}")

    return {
        "session_id": session_id,
        "total_documents": len(sorted_docs),
        "documents": sorted_docs,
        "critical_red_flags": red_flags
    }


# ──────────────────────────────────────────────────────────────────────
# Sarvam AI — STT / TTS Endpoints (async, non-blocking)
# ──────────────────────────────────────────────────────────────────────

@app.post("/api/stt")
async def speech_to_text_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("hi-IN"),
):
    """
    Convert patient voice to text using Sarvam AI.
    Accepts WebM/WAV/MP3 audio blob from the browser.
    Returns transcript and detected language.
    """
    t0 = time.time()
    audio_bytes = await audio.read()

    logger.info(f"STT endpoint: received {len(audio_bytes)} bytes, language={language}, content_type={audio.content_type}")

    # Detect format from content type or filename
    content_type = audio.content_type or "audio/webm"
    fmt = "webm"
    if "wav" in content_type:
        fmt = "wav"
    elif "mp3" in content_type or "mpeg" in content_type:
        fmt = "mp3"
    elif "ogg" in content_type:
        fmt = "ogg"

    # Run in thread pool — sarvam_client uses synchronous httpx
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        sarvam_client.speech_to_text,
        audio_bytes,
        language,
        fmt,
    )

    elapsed = time.time() - t0
    logger.info(f"STT endpoint total: {elapsed:.2f}s | transcript='{result.get('transcript', '')[:60]}'")
    return result


@app.post("/api/tts")
async def text_to_speech_endpoint(
    text: str = Form(...),
    language: str = Form("hi-IN"),
    speaker: str = Form(""),
):
    """
    Convert text to speech using Sarvam AI.
    Returns WAV audio bytes directly for browser playback.
    """
    t0 = time.time()
    logger.info(f"TTS endpoint: text='{text[:60]}', language={language}")

    # Run in thread pool — sarvam_client uses synchronous httpx
    loop = asyncio.get_event_loop()
    audio_bytes = await loop.run_in_executor(
        None,
        sarvam_client.text_to_speech,
        text,
        language,
        speaker if speaker else None,
    )

    elapsed = time.time() - t0
    logger.info(f"TTS endpoint total: {elapsed:.2f}s | audio_size={len(audio_bytes)} bytes")

    if not audio_bytes:
        return JSONResponse(status_code=503, content={"error": "TTS unavailable"})

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )


# ──────────────────────────────────────────────────────────────────────
# WebSocket — Real-time Conversation
# ──────────────────────────────────────────────────────────────────────

@app.websocket("/ws/session")
async def websocket_session(ws: WebSocket):
    """
    Real-time conversation WebSocket.

    Client sends:
      {"type": "start", "clinic_mode": "allopathic", "language": "en-IN"}
      {"type": "input", "input_type": "tap"|"voice"|"skip"|"back"|"next", "value": "..."}
      {"type": "redflag"}
      {"type": "clear_redflag"}
      {"type": "get_record"}

    Server sends:
      {"type": "ui", ...}  — UI instruction from the Dialogue Manager
      {"type": "record", ...}  — Full patient record
      {"type": "error", "message": "..."}
    """
    await ws.accept()
    dm: DialogueManager | None = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                import json as _json
                msg = _json.loads(raw)
            except _json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "start":
                clinic_mode = msg.get("clinic_mode", "allopathic")
                language = msg.get("language", "en-IN")
                dm = DialogueManager(clinic_mode=clinic_mode, language=language)

                # Set demographics if provided
                patient_name = msg.get("patient_name", "")
                patient_age = msg.get("patient_age")
                patient_sex = msg.get("patient_sex", "")
                if patient_name or patient_age or patient_sex:
                    dm.set_demographics(
                        name=patient_name,
                        age=int(patient_age) if patient_age else None,
                        sex=patient_sex,
                    )

                # Bridge: set patient_id so summaries/queue can find this patient
                patient_id = msg.get("patient_id")
                if patient_id:
                    dm.record.patient_id = patient_id

                # If a pre-created session_id was provided, use it instead of auto-generated
                provided_session_id = msg.get("session_id")
                if provided_session_id:
                    dm.record.session_id = provided_session_id

                ui = dm.start_session()
                sessions[dm.record.session_id] = dm
                logger.info(f"Session started: {dm.record.session_id} | lang={language} | mode={clinic_mode} | name={patient_name} | patient_id={patient_id}")
                await ws.send_json({"type": "ui", **ui})

            elif msg_type == "resume":
                provided_session_id = msg.get("session_id")
                if provided_session_id and provided_session_id in sessions:
                    dm = sessions[provided_session_id]
                    logger.info(f"Session resumed: {dm.record.session_id}")
                    ui = dm.resume_session()
                    await ws.send_json({"type": "ui", **ui})
                else:
                    await ws.send_json({"type": "error", "message": "Session not found or expired"})

            elif msg_type == "input":
                if not dm:
                    await ws.send_json({"type": "error", "message": "No active session"})
                    continue
                input_type = msg.get("input_type", "tap")
                value = msg.get("value", "")

                # Send "processing" state to the frontend immediately
                await ws.send_json({
                    "type": "orb_state",
                    "orb_state": "processing",
                })

                t0 = time.time()

                prev_state = dm.fsm.state if hasattr(dm, 'fsm') else ""
                
                # Run the dialogue manager in thread pool (it calls LLM synchronously)
                loop = asyncio.get_event_loop()
                ui = await loop.run_in_executor(
                    None,
                    dm.process_patient_input,
                    input_type,
                    value,
                )
                dm.record.macro_state = dm.fsm.state

                new_state = dm.fsm.state if hasattr(dm, 'fsm') else ""

                logger.info(f"State transition: {prev_state} -> {new_state} | session={dm.record.session_id}")

                # --- Gap A & Timing ---
                # Check safety ALONE after interview completes
                if prev_state == "DYNAMIC_INTERVIEW" and new_state == "DOCUMENT_SCAN":
                    import red_flag_library
                    flags = red_flag_library.check_safety(dm.record.filled_state)
                    if flags:
                        existing_ids = {f.rule_id for f in dm.record.red_flags}
                        new_flags = [f for f in flags if f.rule_id not in existing_ids]
                        if new_flags:
                            dm.record.red_flags.extend(new_flags)
                            reasons = "; ".join(f"{f.rule_id}: {f.description}" for f in new_flags)
                            escalate_queue_priority(dm.record.session_id, reasons)
                            
                # PDF Generation fires HERE (once queue placement is final)
                if prev_state == "SUMMARY_CONFIRMATION" and new_state == "COMPLETE":
                    try:
                        import os, uuid
                        from datetime import datetime
                        from pdf_generator import generate_summary_pdf
                        from routes_extended import _get_db
                        
                        conn = _get_db()
                        existing = conn.execute("SELECT 1 FROM summaries WHERE session_id = ? AND type = 'kiosk' AND pdf_path IS NOT NULL", (dm.record.session_id,)).fetchone()
                        if not existing:
                            q_row = conn.execute("SELECT priority_flag, priority_reason FROM queue WHERE session_id = ?", (dm.record.session_id,)).fetchone()
                            token_id = ""
                            q_tok_row = conn.execute("SELECT token_id FROM queue WHERE session_id = ?", (dm.record.session_id,)).fetchone()
                            if q_tok_row: token_id = q_tok_row["token_id"]
                            
                            pdf_data = dm.record.model_dump()
                            pdf_data["priority_flag"] = bool(q_row["priority_flag"]) if q_row else False
                            pdf_data["priority_reason"] = q_row["priority_reason"] if q_row else ""
                            pdf_data["token_id"] = token_id
                            pdf_data["clinic_mode"] = dm.clinic_mode
                            
                            pdf_bytes = generate_summary_pdf(pdf_data)
                            logger.info(f"PDF bytes generated: {len(pdf_bytes)} bytes")
                            summary_id = f"sum_{uuid.uuid4().hex[:8]}"
                            pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
                            os.makedirs(pdf_dir, exist_ok=True)
                            pdf_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
                            with open(pdf_path, "wb") as f:
                                f.write(pdf_bytes)
                                
                            sess = conn.execute("SELECT patient_id FROM patient_sessions WHERE session_id = ?", (dm.record.session_id,)).fetchone()
                            if sess:
                                now = datetime.utcnow().isoformat()
                                content_json = _json.dumps({
                                    "note": "PDF generated at COMPLETE"
                                })
                                conn.execute(
                                    "INSERT INTO summaries (summary_id, patient_id, session_id, type, content, created_at, pdf_path) VALUES (?, ?, ?, 'kiosk', ?, ?, ?)",
                                    (summary_id, sess["patient_id"], dm.record.session_id, content_json, now, pdf_path)
                                )
                                conn.commit()
                                logger.info(f"PDF saved to DB: summary_id={summary_id}, session_id={dm.record.session_id}")
                            else:
                                logger.error(f"No patient_sessions row for session_id={dm.record.session_id} — PDF written to disk but NOT saved to DB!")
                            logger.info(f"PDF generated for session {dm.record.session_id} at {pdf_path}")
                        else:
                            logger.info(f"PDF already exists for session {dm.record.session_id}, skipping")
                        conn.close()
                    except Exception as pdf_exc:
                        logger.error(f"PDF Generation failed: {pdf_exc}", exc_info=True)

                # Bridge: if red flags fired (from dialogue), escalate queue priority automatically
                if dm.record.red_flags and dm.fsm.state == "EMERGENCY_PROTOCOL":
                    latest_flag = dm.record.red_flags[-1]
                    escalate_queue_priority(
                        dm.record.session_id,
                        f"{latest_flag.rule_id}: {latest_flag.description}"
                    )

                elapsed = time.time() - t0
                logger.info(f"DialogueManager.process_patient_input took {elapsed:.2f}s | state={dm.fsm.state}")

                await ws.send_json({"type": "ui", **ui})

            elif msg_type == "redflag":
                if dm:
                    ui = dm.process_redflag()
                    await ws.send_json({"type": "ui", **ui})

            elif msg_type == "clear_redflag":
                if dm:
                    loop = asyncio.get_event_loop()
                    ui = await loop.run_in_executor(None, dm.clear_redflag)
                    await ws.send_json({"type": "ui", **ui})

            elif msg_type == "get_record":
                if dm:
                    await ws.send_json({"type": "record", **dm.get_record()})
                else:
                    await ws.send_json({"type": "error", "message": "No active session"})

            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
