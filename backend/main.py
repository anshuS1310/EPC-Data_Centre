from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import sys
import os
import shutil

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

app_state = {"ready": False, "error": None}

async def _seed_in_background():
    try:
        await asyncio.to_thread(seed_graph_database)
        await asyncio.to_thread(get_vector_db)
        await asyncio.to_thread(schedule_agent.run_cpm_calculations)
        app_state["ready"] = True
    except Exception as e:
        app_state["error"] = str(e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Cold startup detected. Seeding database states...")
    asyncio.create_task(_seed_in_background())
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
