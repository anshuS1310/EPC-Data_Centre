from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import sys
import os
import shutil
import asyncio
import time

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
from parser.doc_ocr import DocOCRProcessor
from orchestrator.event_bus import EventOrchestrator
from agents.schedule_cost_agent import ScheduleCostAgent
from agents.supply_chain_agent import SupplyChainAgent
from agents.commissioning_agent import CommissioningAgent
from agents.rfi_agent import RFIAgent
from agents.compliance_agent import ComplianceAgent

from contextlib import asynccontextmanager

# Readiness flag — flips to True once background seeding finishes.
# Lets the port open (and Render health checks / uptime pings pass) immediately
# on cold start, instead of blocking on Chroma's first-time embedding-model download.
app_state = {"ready": False, "error": None}

async def _seed_in_background():
    start = time.monotonic()
    try:
        print("Cold startup detected. Seeding database states in background...")
        await asyncio.to_thread(seed_graph_database)
        await asyncio.to_thread(get_vector_db)  # Seeds Chroma (downloads embedding model on first run)
        await asyncio.to_thread(schedule_agent.run_cpm_calculations)
        app_state["ready"] = True
        print(f"Database seeding completed in {time.monotonic() - start:.1f}s.")
    except Exception as e:
        app_state["error"] = str(e)
        print(f"Background seeding failed after {time.monotonic() - start:.1f}s: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_task = asyncio.create_task(_seed_in_background())
    try:
        yield
    finally:
        seed_task.cancel()
        # Graceful shutdown — release KuzuDB file lock so next startup is clean
        from db.graph_db import close_db_connection
        close_db_connection()
        print("Backend shutdown complete.")

# FastAPI Startup Initialization
app = FastAPI(title="AegisEPC Multi-Agent Backend", version="1.0", lifespan=lifespan)

@app.get("/health")
def health_check():
    """Always responds instantly — safe for Render health checks and uptime pingers."""
    return {"status": "ok", "seeding_ready": app_state["ready"], "seeding_error": app_state["error"]}

@app.middleware("http")
async def readiness_guard(request, call_next):
    if app_state["ready"] or request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=503,
        content={"detail": "Backend is still warming up (seeding databases). Retry in a few seconds."},
    )

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

# Initialize Orchestrator and Agents
orchestrator = EventOrchestrator()
schedule_agent = ScheduleCostAgent()
supply_chain_agent = SupplyChainAgent()
commissioning_agent = CommissioningAgent()
