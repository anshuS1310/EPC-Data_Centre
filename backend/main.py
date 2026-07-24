from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os
import shutil

from schemas.api_models import (
    WbsTaskOut, SpecCheckIn, ValidationResultOut, OcrResultOut,
    NcrLogOut, ShipmentOut, RerouteIn, RerouteResultOut,
    ChatQueryIn, ChatResponseOut, CommissioningChecklistOut,
    ChecklistToggleIn, ChecklistItemOut, CertificateOut, AlertCardOut, ProjectIdIn,
    ScheduleImpactIn
)
from db.graph_db import get_db_connection, db_lock
from db.seed_data import seed_graph_database
from db.vector_db import get_vector_db
from parser.doc_ocr import DocOCRProcessor
from orchestrator.event_bus import EventOrchestrator
from agents.schedule_cost_agent import ScheduleCostAgent
from agents.supply_chain_agent import SupplyChainAgent
from agents.commissioning_agent import CommissioningAgent
from agents.rfi_agent import RFIAgent
from agents.compliance_agent import ComplianceAgent

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Cold startup detected. Seeding database states...")
    seed_graph_database()
    get_vector_db()  # Seeds Chroma
    # Initial CPM run
    schedule_agent.run_cpm_calculations()
    print("Database seeding completed.")
    try:
        yield
    finally:
        # Graceful shutdown — release KuzuDB file lock so next startup is clean
        from db.graph_db import close_db_connection
        close_db_connection()
        print("Backend shutdown complete.")

# FastAPI Startup Initialization
app = FastAPI(title="AegisEPC Multi-Agent Backend", version="1.0", lifespan=lifespan)

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        # WSL / network IP access — allow any local network origin in dev
        "http://172.25.228.96:3000",
        "http://172.25.228.96:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Orchestrator and Agents
orchestrator = EventOrchestrator()
schedule_agent = ScheduleCostAgent()
supply_chain_agent = SupplyChainAgent()
commissioning_agent = CommissioningAgent()
rfi_agent = RFIAgent()
compliance_agent = ComplianceAgent()

# ----------------- 1. Schedule & WBS Endpoints -----------------
@app.get("/api/schedule/wbs", response_model=List[WbsTaskOut])
def get_wbs_schedule():
    """
    Returns WBS tasks with CPM Early/Late dates, Total Float, and critical path parameters.
    Declared as def (sync) to allow FastAPI to execute cpu-bound graph traversal on thread pools.
    """
    tasks = []
    try:
        conn = get_db_connection()
        with db_lock:
            res = conn.execute("MATCH (t:ScheduleTask) RETURN t.id, t.code, t.name, t.duration, t.base_duration, t.es, t.ef, t.ls, t.lf, t.tf, t.is_critical, t.status")
            
            while res.has_next():
                row = res.get_next()
                tid, code, name, dur, base_dur, es, ef, ls, lf, tf, is_crit, status = row
                tasks.append(WbsTaskOut(
                    id=tid,
                    code=code,
                    name=name,
                    duration_days=dur,
                    base_duration=base_dur,
                    early_start=es,
                    early_finish=ef,
                    late_start=ls,
                    late_finish=lf,
                    total_float=tf,
                    is_critical=is_crit,
                    status=status
                ))
    except Exception as e:
        print(f"Error fetching WBS schedule: {e}")
    
    # Sort WBS items logically
    tasks.sort(key=lambda x: x.id)
    return tasks

@app.post("/api/schedule/update-impact", response_model=List[WbsTaskOut])
def update_schedule_impact(payload: ScheduleImpactIn):
    """
    Updates schedule task durations dynamically based on Monsoon Severity and Labor Shortages.
    """
    schedule_agent.update_schedule_modifiers(
        monsoon=payload.monsoon_severity,
        labor=payload.labor_shortage
    )
    return get_wbs_schedule()

# ----------------- 2. Spec Compliance Endpoints -----------------
@app.post("/api/compliance/validate", response_model=ValidationResultOut)
def validate_specifications(payload: SpecCheckIn):
    """
    Performs rules checks and triggers event cascades if violations are found.
    """
    # 1. Evaluate compliance rule parameters
    val_res = compliance_agent.validate_specs(
        model_name=payload.model_name,
        clearance_front=payload.clearance_front_mm,
        clearance_rear=payload.clearance_rear_mm,
        piping_length=payload.piping_length_m,
        generator_rating=payload.generator_rating,
        project_id=payload.project_id
    )

    # 2. Trigger Event Cascade for first found violation
    cascade_card = None
    if not val_res["passed"] and val_res["violations"]:
        # Trigger cascade for the first violation
        violation = val_res["violations"][0]
        cascade_card = orchestrator.trigger_compliance_cascade(violation["triggerType"], payload.project_id)

    # Compile schema return structure
    return ValidationResultOut(
        model=payload.model_name,
        passed=val_res["passed"],
        violations=[
            # Map dict to model
            validation_result for validation_result in val_res["violations"]
        ],
        cascade_trace=cascade_card
    )

@app.post("/api/compliance/upload-doc", response_model=OcrResultOut)
def upload_submittal_document(
    file: UploadFile = File(...),
    spec_id: str = Form("SPEC-VERTIV-CRV")
):
    """
    Branching upload handler: Image uploads run Gemini Vision checks; PDFs run Surya OCR.
    """
    temp_dir = "temp_uploads"
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
        
    file_path = os.path.join(temp_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in [".png", ".jpg", ".jpeg"]:
            # Image: Route to Gemini Vision
            with open(file_path, "rb") as f:
                image_bytes = f.read()
            mime_type = "image/png" if ext == ".png" else "image/jpeg"
            
            vision_res = compliance_agent.inspect_layout_drawing(image_bytes, mime_type, spec_id)
            
            # Map to OCR return schema
            return OcrResultOut(
                extracted_clearance_mm=vision_res["value"],
                success=vision_res["success"],
                log=vision_res["log"]
            )
        else:
            # PDF: Route to Surya OCR
            processor = DocOCRProcessor()
            ocr_text = processor.ocr_image(file_path)
            
            # Match parameters from parsed OCR text
            clearance = None
            if "500mm" in ocr_text:
                clearance = 500
            elif "620mm" in ocr_text:
                clearance = 620

            return OcrResultOut(
                extracted_clearance_mm=clearance,
                success=True,
                log=f"PDF parsed via Surya OCR. Text extracted: '{ocr_text[:80]}...'"
            )
    finally:
        # Cleanup temp file
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/api/compliance/export-ncr", response_model=List[NcrLogOut])
def export_ncr_audit_logs():
    """
    Exports open Non-Conformances in a structured format compatible with standard QMS log formats.
    """
    ncrs = []
    try:
        conn = get_db_connection()
        with db_lock:
            res = conn.execute(
                "MATCH (n:NonConformance) "
                "OPTIONAL MATCH (n)-[:AFFECTS_TASK]->(t:ScheduleTask) "
                "RETURN n.id, n.spec_clause, n.title, n.description, n.status, n.cost, n.delay, n.project_id, t.id"
            )
            
            while res.has_next():
                row = res.get_next()
                nid, spec, title, desc, status, cost, delay, pid, task_id = row
                
                ncrs.append(NcrLogOut(
                    id=nid,
                    project_id=pid or "PRJ-MUM-01",
                    title=title,
                    description=desc,
                    spec_clause=spec,
                    status=status,
                    rectification_cost_inr=cost,
                    delay_impact_days=delay,
                    affected_task_id=task_id or 0
                ))
    except Exception as e:
        print(f"Error exporting NCR audit logs: {e}")

    return ncrs

# ----------------- 3. Supply Chain Endpoints -----------------
@app.get("/api/supply-chain/shipments", response_model=List[ShipmentOut])
def get_shipments():
    """
    Returns active shipments with Tier-2 sub-supplier dependencies from KuzuDB.
    """
    return supply_chain_agent.get_active_shipments()

@app.post("/api/supply-chain/reroute", response_model=RerouteResultOut)
def reroute_shipment_po(payload: RerouteIn):
    """
    Reroutes a delayed shipment PO to a pre-certified alternate vendor.
    """
    success = supply_chain_agent.reroute_po(payload.shipment_id, payload.alternative_supplier_name)
    if not success:
        raise HTTPException(status_code=404, detail="Shipment PO not found.")
    
    # Recalculate CPM floats and cost risk
    schedule_agent.run_cpm_calculations()
    cost_res = schedule_agent.compute_cost_risk("PRJ-MUM-01")

    return RerouteResultOut(
        success=True,
        new_status="ON_TIME",
        updated_delay_days=cost_res["delay_days"]
    )

# ----------------- 4. RFI & Knowledge Endpoints -----------------
@app.post("/api/rfi/chat", response_model=ChatResponseOut)
def rfi_chat_query(payload: ChatQueryIn):
    """
    Executes a RAG cited response on Chroma vector DB and checks for duplicate RFIs in KuzuDB.
    """
    return rfi_agent.run_rag_query(payload.query)

# ----------------- 5. Commissioning QA Endpoints -----------------
@app.get("/api/commissioning/checklist", response_model=List[CommissioningChecklistOut])
def get_commissioning_checklists():
    return commissioning_agent.get_checklist_by_levels()

@app.post("/api/commissioning/verify", response_model=ChecklistItemOut)
def toggle_commissioning_item(payload: ChecklistToggleIn):
    res = commissioning_agent.toggle_checklist_item(payload.level, payload.item_id)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error_msg"])
    
    return ChecklistItemOut(
        id=res["id"],
        description="",
        status=res["status"],
        verified_value=res["verified_value"]
    )

@app.post("/api/commissioning/certificate", response_model=CertificateOut)
def generate_acceptance_certificate(payload: ProjectIdIn):
    cert = commissioning_agent.compile_certificate(payload.project_id)
    return CertificateOut(
        project_name=cert["project_name"],
        city=cert["city"],
        tier_rating=cert["tier_rating"],
        commissioning_standard=cert["commissioning_standard"],
        status=cert["status"],
        date=cert["date"],
        signatures=cert["signatures"]
    )

# ----------------- 6. Orchestrator alerts Endpoints -----------------
@app.get("/api/orchestrator/alerts", response_model=List[AlertCardOut])
def get_active_cascade_alerts():
    return orchestrator.get_all_alerts()

@app.post("/api/orchestrator/clear")
def clear_orchestrator_alerts():
    orchestrator.clear_all_alerts()
    return {"status": "success", "message": "Alert logs cleared and database stats reset."}

# Run FastAPI Server on localhost:8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
