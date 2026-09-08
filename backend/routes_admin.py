from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import database

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

class DepartmentReq(BaseModel):
    name: str

class DoctorReq(BaseModel):
    full_name: str
    dept_id: int
    license_number: str
    max_daily_patients: int = 40
    profile_image_url: Optional[str] = None
    room_number: str = "TBD"
    username: str
    password: str
    admin_email: str = "admin@swasthyasync.com"

class DoctorUpdateReq(BaseModel):
    full_name: str
    dept_id: int
    license_number: str
    max_daily_patients: int
    status: str
    room_number: str
    profile_image_url: Optional[str] = None
    username: str
    password: str
    admin_email: str = "admin@swasthyasync.com"

class RuleReq(BaseModel):
    trigger_keyword: str
    action_type: str
    action_value: Optional[str] = None

class PatientUpdateReq(BaseModel):
    admin_email: str
    updates: Dict[str, Any]

class AdminActionReq(BaseModel):
    admin_email: str

@admin_router.get("/analytics")
async def get_analytics():
    return database.get_analytics_metrics()

@admin_router.get("/queues")
async def get_queues():
    # Reuse the existing fetch_triage_queue but filter for IN_PROGRESS
    all_queues = database.fetch_triage_queue()
    in_progress = [q for q in all_queues if q.get("session_status") == "IN_PROGRESS"]
    return in_progress

@admin_router.put("/queue/{session_id}/downgrade")
async def downgrade_queue(session_id: str, req: AdminActionReq):
    database.downgrade_priority(session_id, req.admin_email)
    return {"status": "success", "message": f"Session {session_id} downgraded to normal priority."}

@admin_router.get("/doctors")
async def get_doctors():
    return database.get_doctors()

@admin_router.post("/doctors")
async def add_doctor(req: DoctorReq):
    try:
        database.add_doctor(
            req.full_name, req.dept_id, req.license_number, 
            req.max_daily_patients, req.profile_image_url, req.room_number,
            req.username, req.password
        )
        database.log_system_action(req.admin_email, "ADD_DOCTOR", req.full_name)
        return {"status": "success"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) and "username" in str(e):
            raise HTTPException(status_code=400, detail="Username is already taken. Please choose another one.")
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: int, req: DoctorUpdateReq):
    try:
        # Since we might not want to overwrite current_status if it's not in req, we can leave it as default or fetch it first.
        # But for now, we'll fetch the existing doctor to keep their current_status.
        existing_doctors = database.get_doctors()
        existing = next((d for d in existing_doctors if d["doctor_id"] == doctor_id), None)
        curr_status = existing["current_status"] if existing and "current_status" in existing else "Available"
        
        database.update_doctor(
            doctor_id, req.full_name, req.dept_id, req.license_number, 
            req.max_daily_patients, req.status, req.room_number, req.profile_image_url,
            req.username, req.password, curr_status
        )
        database.log_system_action(req.admin_email, "EDIT_DOCTOR", str(doctor_id))
        return {"status": "success"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) and "username" in str(e):
            raise HTTPException(status_code=400, detail="Username is already taken. Please choose another one.")
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.get("/departments")
async def get_departments():
    return database.get_departments()

@admin_router.post("/departments")
async def add_department(req: DepartmentReq):
    try:
        database.add_department(req.name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.put("/departments/{dept_id}/default")
async def set_default_department(dept_id: int):
    try:
        import database
        conn = database.get_connection()
        conn.execute("UPDATE departments SET is_default = 0")
        conn.execute("UPDATE departments SET is_default = 1 WHERE dept_id = ?", (dept_id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.get("/rules")
async def get_rules():
    return database.get_rules()

@admin_router.post("/rules")
async def add_rule(req: RuleReq):
    database.add_rule(req.trigger_keyword, req.action_type, req.action_value)
    return {"status": "success"}

@admin_router.get("/patients")
async def get_patients():
    return database.get_all_patients()

@admin_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, req: PatientUpdateReq):
    database.update_patient_details(patient_id, req.updates, req.admin_email)
    return {"status": "success"}

@admin_router.post("/reset-clinic")
async def reset_clinic(req: AdminActionReq):
    database.archive_active_queues(req.admin_email)
    return {"status": "success", "message": "All active queues archived."}

@admin_router.get("/logs")
async def get_logs():
    return database.get_system_logs()
