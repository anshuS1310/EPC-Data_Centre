import sys
import os
import shutil
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure current directory is on sys.path for submodule imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
from orchestrator.event_bus import EventOrchestrator
from agents.schedule_cost_agent import ScheduleCostAgent
from agents.supply_chain_agent import SupplyChainAgent
from agents.commissioning_agent import CommissioningAgent
from agents.rfi_agent import RFIAgent
from agents.compliance_agent import ComplianceAgent

# NOTE: DocOCRProcessor is intentionally NOT imported here at module level.
# It (and any Vision/OCR backends it wraps) is imported lazily inside the
# upload endpoint, so a cold Render instance doesn't pay that import cost
# just to answer /health or any non-OCR route.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aegis-epc")

# Initialize Orchestrator and Agents (kept lightweight / no I/O at import time)
orchestrator = EventOrchestrator()
schedule_agent = ScheduleCostAgent()
supply_chain_agent = SupplyChainAgent()
commissioning_agent = CommissioningAgent()
rfi_agent = RFIAgent()
compliance_agent = ComplianceAgent()


async def _background_bootstrap(app: FastAPI) -> None:
    """
    Runs the heavy, one-time startup work (graph DB seeding, vector DB seeding,
    initial CPM run) OFF the startup critical path, in a worker thread, so
    uvicorn can bind to the port and answer /health immediately.

    This matters specifically on Render's free tier: the platform's own proxy
    will return a 502/504 if nothing is listening on the port within its
    startup timeout window. Blocking on seeding inside `lifespan` risks that.
    """
    try:
        logger.info("Cold startup detected. Seeding database states in background...")
        await asyncio.to_thread(seed_graph_database)
        await asyncio.to_thread(get_vector_db)  # Seeds Chroma
        await asyncio.to_thread(schedule_agent.run_cpm_calculations)
        app.state.ready = True
        app.state.boot_error = None
        logger.info("Database seeding completed. Service is fully ready.")
    except Exception as e:
        # Don't crash the process — surface the error via /health and let
        # dependent routes 503 instead of 500ing unpredictably.
        logger.exception("Background bootstrap failed: %s", e)
        app.state.ready = False
        app.state.boot_error = str(e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    app.state.boot_error = None
    # Fire-and-forget: do NOT await this. Uvicorn must be able to bind and
    # start serving /health immediately, even while this task runs.
    bootstrap_task = asyncio.create_task(_background_bootstrap(app))
    try:
        yield
    finally:
        bootstrap_task.cancel()
        from db.graph_db import close_db_connection
        close_db_connection()
        logger.info("Backend shutdown complete.")


app = FastAPI(title="AegisEPC Multi-Agent Backend", version="1.0", lifespan=lifespan)

# Enable CORS — allow all origins since the Next.js frontend proxies all
# API calls server-side (browser never hits the backend directly).
FRONTEND_ORIGIN = os.environ.get("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_ready(request: Request):
    """
    Dependency for routes that need the graph/vector DB to be seeded.
    Returns a clean 503 (with Retry-After) instead of letting a half-seeded
    DB throw a confusing/raw exception that looks like a crash to the client.
    """
    if not getattr(request.app.state, "ready", False):
        if getattr(request.app.state, "boot_error", None):
            raise HTTPException(
                status_code=503,
                detail=f"Service failed to initialize: {request.app.state.boot_error}",
            )
        raise HTTPException(
            status_code=503,
            detail="Service is warming up (cold start). Please retry in a few seconds.",
            headers={"Retry-After": "5"},
        )


# ----------------- 0. Health Check -----------------
@app.get("/health")
def health_check():
    """Lightweight liveness probe — no DB access, instant response even during cold start.
    Point your uptime/keep-alive pinger (see notes) at THIS endpoint."""
    return {"status": "ok", "service": "AegisEPC Backend"}


@app.get("/api/health")
def api_health_check(request: Request):
    """Alias under /api prefix for Next.js proxy health polling.
    Also reports readiness so the frontend can distinguish 'alive but warming up'
    from 'fully ready'."""
    return {
        "status": "ok",
        "service": "AegisEPC Backend",
        "ready": getattr(request.app.state, "ready", False),
        "boot_error": getattr(request.app.state, "boot_error", None),
    }


# ----------------- 1. Schedule & WBS Endpoints -----------------
@app.get("/api/schedule/wbs", response_model=List[WbsTaskOut], dependencies=[Depends(require_ready)])
def get_wbs_schedule():
    """
    Returns WBS tasks with CPM Early/Late dates, Total Float, and critical path parameters.
    """
    tasks = []
    try:
        conn = get_db_connection()
        with db_lock:
            res = conn.execute(
                "MATCH (t:ScheduleTask) RETURN t.id, t.code, t.name, t.duration, t.base_duration, "
                "t.es, t.ef, t.ls, t.lf, t.tf, t.is_critical, t.status"
            )

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
        logger.error(f"Error fetching WBS schedule: {e}")

    tasks.sort(key=lambda x: x.id)
    return tasks


@app.post("/api/schedule/update-impact", response_model=List[WbsTaskOut], dependencies=[Depends(require_ready)])
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
@app.post("/api/compliance/validate", response_model=ValidationResultOut, dependencies=[Depends(require_ready)])
def validate_specifications(payload: SpecCheckIn):
    """
    Performs rules checks and triggers event cascades if violations are found.
    """
    val_res = compliance_agent.validate_specs(
        model_name=payload.model_name,
        clearance_front=payload.clearance_front_mm,
        clearance_rear=payload.clearance_rear_mm,
        piping_length=payload.piping_length_m,
        generator_rating=payload.generator_rating,
        project_id=payload.project_id
    )

    cascade_card = None
    if not val_res["passed"] and val_res["violations"]:
        violation = val_res["violations"][0]
        cascade_card = orchestrator.trigger_compliance_cascade(violation["triggerType"], payload.project_id)

    return ValidationResultOut(
        model=payload.model_name,
        passed=val_res["passed"],
        violations=[v for v in val_res["violations"]],
        cascade_trace=cascade_card
    )


@app.post("/api/compliance/upload-doc", response_model=OcrResultOut, dependencies=[Depends(require_ready)])
def upload_submittal_document(
    file: UploadFile = File(...),
    spec_id: str = Form("SPEC-VERTIV-CRV")
):
    """
    Multi-Modal OCR & Specification Extractor:
    - Text-based PDF: Fast & free text extraction via PyPDF.
    - Images & Scanned PDFs: Vision analysis via Gemini (rendering page pixmap via PyMuPDF for scanned PDFs).
    - Rate-Limit Guard: MD5 Hash Caching to optimize Gemini Free Tier API usage.
    - Lazy Import: Heavy OCR/PDF libraries are imported inside the endpoint to keep cold startup fast.
    """
    file_bytes = file.file.read()
    from parser.doc_ocr import DocOCRProcessor
    processor = DocOCRProcessor()
    
    res = processor.process_document(
        file_bytes=file_bytes,
        filename=file.filename,
        spec_id=spec_id,
        llm_helper=compliance_agent.llm
    )

    return OcrResultOut(
        extracted_clearance_mm=res.get("extracted_clearance_mm"),
        extracted_piping_length_m=res.get("extracted_piping_length_m"),
        extracted_model=res.get("extracted_model"),
        extracted_rating=res.get("extracted_rating"),
        success=res.get("success", True),
        log=res.get("log", "Document processed successfully.")
    )



@app.get("/api/compliance/export-ncr", response_model=List[NcrLogOut], dependencies=[Depends(require_ready)])
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
        logger.error(f"Error exporting NCR audit logs: {e}")

    return ncrs


# ----------------- 3. Supply Chain Endpoints -----------------
@app.get("/api/supply-chain/shipments", response_model=List[ShipmentOut], dependencies=[Depends(require_ready)])
def get_shipments():
    """
    Returns active shipments with Tier-2 sub-supplier dependencies from KuzuDB.
    """
    return supply_chain_agent.get_active_shipments()


@app.post("/api/supply-chain/reroute", response_model=RerouteResultOut, dependencies=[Depends(require_ready)])
def reroute_shipment_po(payload: RerouteIn):
    """
    Reroutes a delayed shipment PO to a pre-certified alternate vendor.
    """
    success = supply_chain_agent.reroute_po(payload.shipment_id, payload.alternative_supplier_name)
    if not success:
        raise HTTPException(status_code=404, detail="Shipment PO not found.")

    schedule_agent.run_cpm_calculations()
    cost_res = schedule_agent.compute_cost_risk("PRJ-MUM-01")

    return RerouteResultOut(
        success=True,
        new_status="ON_TIME",
        updated_delay_days=cost_res["delay_days"]
    )


# ----------------- 4. RFI & Knowledge Endpoints -----------------
@app.post("/api/rfi/chat", response_model=ChatResponseOut, dependencies=[Depends(require_ready)])
def rfi_chat_query(payload: ChatQueryIn):
    """
    Executes a RAG cited response on Chroma vector DB and checks for duplicate RFIs in KuzuDB.
    """
    return rfi_agent.run_rag_query(payload.query)


# ----------------- 5. Commissioning QA Endpoints -----------------
@app.get("/api/commissioning/checklist", response_model=List[CommissioningChecklistOut], dependencies=[Depends(require_ready)])
def get_commissioning_checklists():
    return commissioning_agent.get_checklist_by_levels()


@app.post("/api/commissioning/verify", response_model=ChecklistItemOut, dependencies=[Depends(require_ready)])
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


@app.post("/api/commissioning/certificate", response_model=CertificateOut, dependencies=[Depends(require_ready)])
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
@app.get("/api/orchestrator/alerts", response_model=List[AlertCardOut], dependencies=[Depends(require_ready)])
def get_active_cascade_alerts():
    return orchestrator.get_all_alerts()


@app.post("/api/orchestrator/clear", dependencies=[Depends(require_ready)])
def clear_orchestrator_alerts():
    orchestrator.clear_all_alerts()
    return {"status": "success", "message": "Alert logs cleared and database stats reset."}


# Run FastAPI Server
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
