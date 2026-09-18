from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import json

import database
from llm_client import generate_portal_chat_reply

logger = logging.getLogger(__name__)

portal_router = APIRouter(tags=["Patient Portal"])

class ChatRequest(BaseModel):
    identifier: str
    user_message: str

@portal_router.get("/api/portal/history/{identifier}")
async def get_patient_history(identifier: str):
    """Fetch all past completed consultations for the patient."""
    try:
        history = await database.fetch_patient_history_by_identifier(identifier)
        return history
    except Exception as e:
        logger.error(f"Error fetching patient history for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching history")

@portal_router.get("/api/portal/documents/{identifier}")
async def get_patient_documents(identifier: str):
    """Fetch all documents uploaded by the patient."""
    try:
        documents = await database.fetch_patient_documents_by_identifier(identifier)
        return documents
    except Exception as e:
        logger.error(f"Error fetching patient documents for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching documents")

@portal_router.post("/api/portal/chat")
async def patient_portal_chat(request: ChatRequest):
    """Context-aware AI chatbot using the patient's latest clinical record (RAG)."""
    try:
        # 1. Fetch the patient's latest clinical summary from the DB
        latest_record = await database.fetch_latest_clinical_record(request.identifier)
        
        if not latest_record:
            return {"reply": "I couldn't find any recent medical records for your profile. How can I help you today?"}
            
        # 2. Inject it into the System Prompt
        system_prompt = f"""
        You are SwasthyaSync's helpful Medical Assistant. You are talking directly to the patient.
        Here is the patient's latest official clinical record and prescription from their doctor:
        {json.dumps(latest_record, indent=2)}

        Rules:
        1. Answer the patient's questions ONLY based on the provided clinical record.
        2. If they ask about medication timing or dosages, quote the exact dosage from the record.
        3. If they ask something not in the record, politely tell them you don't have that information.
        4. Keep answers short, friendly, and easy to read on a mobile phone.
        5. Always include a disclaimer for severe symptoms, advising them to consult a doctor.
        """
        
        # 3. Call Gemini with the system prompt + patient's question
        reply = generate_portal_chat_reply(system_prompt, request.user_message)
        
        return {"reply": reply}
        
    except Exception as e:
        logger.error(f"Error in portal chat for {request.identifier}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error generating chat reply")
