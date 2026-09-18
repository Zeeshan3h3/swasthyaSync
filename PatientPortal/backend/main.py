from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import json
import os
import uuid
import random as _random
import time as _time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import database
from llm_client import generate_portal_chat_reply

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── OTP Provider & Verified Sessions ──────────────────────────────────
from services.otp_provider import get_otp_provider, mask_phone as _mask_phone
verified_sessions: dict[str, str] = {}   # token → phone


# ── Auth Dependency ────────────────────────────────────────────────────
async def get_verified_phone(authorization: str = Header(default="")) -> str:
    """Extract and validate the bearer token from the Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header. Please log in.")
    token = authorization.replace("Bearer ", "").strip()
    phone = verified_sessions.get(token)
    if not phone:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")
    return phone


# ── Pydantic Models ────────────────────────────────────────────────────
class PortalOtpInitReq(BaseModel):
    phone: str

class PortalOtpConfirmReq(BaseModel):
    transaction_id: str
    otp: str

class ChatRequest(BaseModel):
    user_message: str
    history: list[dict] = []


# ── App Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Standalone Patient Portal Backend starting...")
    await database.init_db_pool()
    yield
    await database.close_db_pool()

app = FastAPI(title="SwasthyaSync Mobile Portal API", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Utility ────────────────────────────────────────────────────────────
def _mask_phone(phone: str) -> str:
    clean = phone.replace("+91", "").replace(" ", "").strip()
    if len(clean) <= 4:
        return "X" * len(clean)
    return "X" * (len(clean) - 4) + clean[-4:]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUTH ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/portal/auth/init")
async def portal_otp_init(req: PortalOtpInitReq):
    """
    Step 1: Patient enters phone number → dispatch OTP via otp_provider.
    Returns transaction_id + masked phone hint.
    """
    provider = get_otp_provider()
    result = await provider.send_otp(req.phone, purpose="portal_login")
    if not result.success:
        status_code = 429 if result.error_code == "RATE_LIMITED" else (400 if result.error_code == "INVALID_PHONE" else 500)
        raise HTTPException(status_code, detail={"code": result.error_code or "SEND_FAILED", "message": result.message})

    logger.info(f"[Portal Auth] OTP requested for {result.phone_hint} → txn={result.transaction_id}")

    return {
        "transaction_id": result.transaction_id,
        "phone_hint": result.phone_hint,
        "message": result.message,
        "resend_after_seconds": result.resend_after_seconds,
        **({"debug_otp": result.debug_otp} if result.debug_otp else {}),
    }


@app.post("/api/portal/auth/confirm")
async def portal_otp_confirm(req: PortalOtpConfirmReq):
    """
    Step 2: Patient enters OTP → validate via otp_provider, return session token.
    """
    provider = get_otp_provider()
    verify_result = await provider.verify_otp(req.transaction_id, req.otp, purpose="portal_login")
    if not verify_result.success:
        raise HTTPException(
            verify_result.status_code,
            detail={
                "code": verify_result.error_code or "INVALID_OTP",
                "message": verify_result.error_message or "Incorrect OTP.",
                "attempts_remaining": verify_result.attempts_remaining,
            }
        )

    phone = verify_result.phone

    # Generate session token
    token = uuid.uuid4().hex
    verified_sessions[token] = phone
    logger.info(f"[Portal Auth] Phone {_mask_phone(phone)} verified. Token issued.")

    return {
        "status": "success",
        "token": token,
        "phone": phone,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROTECTED DATA ENDPOINTS (require auth token)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/history")
async def get_patient_history(phone: str = Depends(get_verified_phone)):
    """Fetch all past completed consultations for the authenticated patient."""
    try:
        history = await database.fetch_patient_history_by_identifier(phone)
        return history
    except Exception as e:
        logger.error(f"Error fetching patient history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching history")


@app.get("/api/portal/documents")
async def get_patient_documents(phone: str = Depends(get_verified_phone)):
    """Fetch all documents uploaded by the authenticated patient."""
    try:
        documents = await database.fetch_patient_documents_by_identifier(phone)
        return documents
    except Exception as e:
        logger.error(f"Error fetching patient documents: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching documents")


@app.post("/api/portal/chat")
async def patient_portal_chat(request: ChatRequest, phone: str = Depends(get_verified_phone)):
    """Context-aware AI chatbot using the patient's latest clinical record (RAG)."""
    try:
        latest_record = await database.fetch_latest_clinical_record(phone)

        if not latest_record:
            return {"reply": "I couldn't find any recent medical records for your profile. How can I help you today?"}

        conv_text = ""
        if request.history:
            recent = request.history[-6:]
            turns = []
            for m in recent:
                sender_label = "Patient" if m.get("sender") == "user" else "Assistant"
                turns.append(f"{sender_label}: {m.get('text', '')}")
            conv_text = "\nPrevious Conversation Context:\n" + "\n".join(turns) + "\n"

        system_prompt = f"""
        You are SwasthyaSync's helpful Medical Assistant. You are talking directly to the patient.
        Here is the patient's latest official clinical record and prescription from their doctor:
        {json.dumps(latest_record, indent=2)}
        {conv_text}

        Rules:
        1. Answer the patient's questions ONLY based on the provided clinical record and previous conversation context.
        2. If they ask about medication timing or dosages, quote the exact dosage from the record.
        3. If they ask something not in the record, politely tell them you don't have that information.
        4. Keep answers short, friendly, and easy to read on a mobile phone.
        5. Always include a disclaimer for severe symptoms, advising them to consult a doctor.
        """

        reply = generate_portal_chat_reply(system_prompt, request.user_message)
        return {"reply": reply}

    except Exception as e:
        logger.error(f"Error in portal chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error generating chat reply")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PUBLIC ENDPOINTS (no auth required)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/hospital-info")
async def get_hospital_info():
    """Public hospital information — departments, doctor counts, active patients."""
    try:
        info = await database.fetch_hospital_info()
        return info
    except Exception as e:
        logger.error(f"Error fetching hospital info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUTHENTICATED FEATURE ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/queue-status")
async def get_queue_status(phone: str = Depends(get_verified_phone)):
    """Live queue status for the authenticated patient."""
    try:
        active = await database.fetch_active_queue_for_phone(phone)
        return {"active_sessions": active}
    except Exception as e:
        logger.error(f"Error fetching queue status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/portal/feedback")
async def submit_feedback(request: dict, phone: str = Depends(get_verified_phone)):
    """Submit post-visit feedback for a session."""
    session_id = request.get("session_id")
    rating = request.get("rating")
    comment = request.get("comment", "")

    if not session_id or not rating:
        raise HTTPException(400, detail="session_id and rating are required.")
    if not (1 <= int(rating) <= 5):
        raise HTTPException(400, detail="Rating must be between 1 and 5.")

    try:
        await database.save_patient_feedback(session_id, phone, int(rating), comment)
        return {"status": "saved"}
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/portal/export")
async def export_all_records(phone: str = Depends(get_verified_phone)):
    """Export all patient records as a single JSON bundle (Health Vault)."""
    try:
        history = await database.fetch_patient_history_by_identifier(phone)
        documents = await database.fetch_patient_documents_by_identifier(phone)
        patient_info = await database.fetch_patient_info_by_phone(phone)

        return {
            "patient": patient_info,
            "consultations": history,
            "documents": documents,
            "exported_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        }
    except Exception as e:
        logger.error(f"Error exporting records: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
