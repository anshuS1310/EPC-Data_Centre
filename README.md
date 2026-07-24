# DCIMS / AegisEPC — AI Intelligence Platform for Data Centre EPC Project Delivery

**Live Demo** - https://epc-data-centre-frontend.onrender.com

> An end-to-end, multi-agent AI intelligence platform that unifies project specifications, schedules, procurement data, geospatial logistics, and commissioning records into a living knowledge graph — eliminating schedule overruns, automating quality compliance, and guaranteeing Uptime Tier III/IV SLA standards for hyperscale data centre construction.

---

## Executive Summary & Problem Context

India is undergoing an unprecedented data centre infrastructure expansion. National capacity is projected to surge from ~900 MW in 2024 to over 2,700 MW by 2027, representing more than **$15 billion in capital deployment**. 

Building a single hyperscale data centre is one of the most complex engineering endeavors in modern infrastructure:
* **15,000 to 40,000 equipment line items** across electrical, mechanical, and cooling subsystems.
* **Up to 200 concurrent trade contractors** operating simultaneously on site.
* **Thousands of sequential commissioning test procedures** with zero tolerance for errors that could jeopardize future uptime SLAs.

According to industry surveys, over **67% of data centre EPC (Engineering, Procurement, and Construction) projects in Asia-Pacific suffer schedule overruns exceeding 10%**, primarily driven by procurement misalignment, specification drift, and late-stage commissioning bottlenecks.

### The Underlying Root Cause: Information Fragmentation
Equipment specifications, vendor submittal PDFs, CPM schedules, RFI logs, and test records exist in disconnected silos. Crucial linkages—such as how a 2-week delay in a Tier-2 semiconductor sub-supplier impacts Level 4 Integrated Systems Testing—are lost in manual coordination overhead.

**DCIMS (Data Centre Infrastructure Management System / AegisEPC)** solves this challenge by introducing an **AI Intelligence Layer** over project data. It automatically catches specification non-conformances before equipment arrives on site, predicts critical-path schedule risks weeks in advance, models alternate supply routes, and ensures that as-built facilities satisfy stringent BICSI and Uptime Institute Tier III/IV requirements.

---

## Core System Architecture & Multi-Agent Framework

DCIMS is architected around a **Graph-Centric Multi-Agent Engine** powered by an embedded **KuzuDB Graph Database**, **ChromaDB Vector Store**, and **Google Gemini 3.5/3.6 Flash LLM** models.

```
                   ┌──────────────────────────────────────────┐
                   │    DCIMS Next.js 16 Web Dashboard       │
                   └────────────────────┬─────────────────────┘
                                        │ (REST APIs)
                   ┌────────────────────▼─────────────────────┐
                   │        FastAPI Event Orchestrator       │
                   └───────┬────────────┬────────────┬────────┘
                           │            │            │
         ┌─────────────────▼──┐  ┌──────▼──────┐  ┌──▼────────────────┐
         │ Spec Compliance    │  │ Schedule    │  │ Supply Chain      │
         │ Agent              │  │ Risk Engine │  │ Visibility Agent  │
         └─────────┬──────────┘  └──────┬──────┘  └──┬────────────────┘
                   │                    │            │
         ┌─────────▼──────────┐  ┌──────▼──────┐  ┌──▼────────────────┐
         │ Commissioning      │  │ RFI RAG     │  │ KuzuDB Graph DB   │
         │ QA Copilot         │  │ Knowledge   │  │ & ChromaDB        │
         └────────────────────┘  └─────────────┘  └───────────────────┘
```

### 1. Specification & Quality Compliance Agent
* **Purpose**: Ingests equipment specification sheets, single-line diagrams, and architectural drawings. Automatically checks vendor submittals against project standards before procurement orders are finalized.
* **Key Capabilities**:
  * Multimodal OCR & Vision Parsing via **Google Gemini Vision API** for layout clearance drawings.
  * Safety Gate evaluation against KuzuDB graph node properties (e.g. front/rear clearance bounds, pipe length limits, generator ISO 8528-1 ratings).
  * Automated logging of Non-Conformance Reports (NCRs) with instant cost rework and schedule delay estimates.

### 2. Predictive Schedule & Cost Risk Engine
* **Purpose**: Executes deterministic Critical Path Method (CPM) Forward and Backward passes over WBS tasks while factoring in dynamic real-time risk modifiers.
* **Key Capabilities**:
  * Real-time CPM calculation computing Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF), and Total Float (TF) per task.
  * Interactive Risk Simulation Sliders for **Monsoon Severity** and **Labor Shortage Index**, allowing project managers to run stress tests.
  * Automatic identification of critical path shifts and financial cost exposure (₹ Cr) before delays occur.

### 3. Supply Chain Visibility & Risk Agent
* **Purpose**: Tracks critical equipment PO shipments (UPS units, chillers, generators, STS units) across multi-tier international suppliers.
* **Key Capabilities**:
  * Live GIS map tracking with precise geographic coordinates for inbound maritime and domestic shipments.
  * Tier-2 sub-supplier component bottleneck detection (e.g. TSMC PMIC delays).
  * One-click **Alternate Supplier Rerouting** that dynamically updates graph edges in KuzuDB, reducing lead times from weeks to days and automatically clearing downstream task blocks.

### 4. Commissioning Quality Assurance Copilot
* **Purpose**: Guides field engineers through BICSI 002-2024 and Uptime Institute Tier III/IV Integrated Systems Testing (IST) Level 1–5 sequences.
* **Key Capabilities**:
  * Level 1 (FAT) to Level 5 (Handover & Digital Twin Baseline) verification tracking.
  * Smart Dependency Enforcement: Automatically blocks Level 4 blackout test execution if an upstream generator or piping NCR is open in the graph database.
  * Automated compilation of digital Acceptance Certificates with audit trail signatures.

### 5. Project Knowledge & RFI Intelligence Agent
* **Purpose**: Provides a conversational RAG interface over project documentation, past technical queries, and specification clauses.
* **Key Capabilities**:
  * Hybrid retrieval pairing **ChromaDB Vector Embeddings** with **KuzuDB Graph Context**.
  * Instant Duplicate RFI Detection to prevent redundant engineering submittals.
  * Powered by Gemini 3.5/3.6 Flash models with instant rule fallback for sub-millisecond response reliability.

---

## Event-Driven Cross-Agent Cascade

When a non-conformance or risk event is triggered (e.g., a Vertiv CRV+ clearance violation or generator prime rating mismatch), the **Orchestrator Event Bus** propagates the risk across all agents in real time:

```
[Quality Compliance Agent] ──▶ Logs NCR in KuzuDB
                                   │
                                   ▼
[Schedule & Cost Engine] ──▶ Recalculates CPM Float & elevates Cost Exposure
                                   │
                                   ▼
[Supply Chain Agent]    ──▶ Identifies Tier-2 component delay & models reroute
                                   │
                                   ▼
[Commissioning Agent]   ──▶ Blocks Level 4 IST Blackout Test until resolved
                                   │
                                   ▼
[RFI Knowledge Agent]   ──▶ Indexes resolution for site engineering team
```

---

## Tech Stack & Frameworks

### Frontend (`/aegis-epc`)
* **Framework**: Next.js 16 (App Router with Turbopack) & React 19
* **Styling**: Tailwind CSS v4 with custom responsive design system
* **Icons & UI**: Lucide React
* **Charts**: Recharts (Schedule Baseline vs. Projected, Risk Exposure Trends)
* **Maps**: Leaflet / MapLibre GIS for real-time shipment routing

### Backend (`/backend`)
* **Framework**: FastAPI (Python 3.11+) with Uvicorn ASGI server
* **Graph Database**: **KuzuDB** (embedded single-process graph engine with thread-safe locking)
* **Vector Store**: **ChromaDB** with local embeddings
* **AI Engine**: Google GenAI SDK (`gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`)
* **Document Processing**: PyPDF2, Pillow, OpenCV, Google Gemini Vision

---

## Directory Structure

```
EPC/
├── backend/
│   ├── main.py                     # FastAPI application routes & lifespan initialization
│   ├── kuzu_db_data/               # Persistent KuzuDB single-file graph database
│   ├── db/
│   │   ├── graph_db.py             # KuzuDB connection pool & schema definitions
│   │   ├── seed_data.py            # Baseline EPC WBS & equipment graph dataset
│   │   └── vector_db.py            # ChromaDB vector store initialization
│   ├── agents/
│   │   ├── compliance_agent.py     # Spec verification & vision OCR inspection
│   │   ├── schedule_cost_agent.py  # CPM algorithm solver & float calculator
│   │   ├── supply_chain_agent.py   # Multi-tier PO tracking & rerouting engine
│   │   ├── commissioning_agent.py  # BICSI Level 1-5 verification engine
│   │   ├── rfi_agent.py            # RAG conversational engine & duplicate spotter
│   │   └── llm_helper.py           # Gemini API client & fallback hierarchy
│   └── orchestrator/
│       └── event_bus.py            # Cross-agent event propagation bus
│
└── aegis-epc/                      # Next.js Frontend App
    ├── app/
    │   ├── page.js                 # Dashboard main view
    │   ├── layout.js               # Root layout & font configurations
    │   ├── context/
    │   │   └── SharedBrainContext.jsx # Global state management & backend sync
    │   └── components/
    │       ├── Header.jsx          # Top bar with site selector & 6 live KPI chips
    │       ├── Sidebar.jsx         # Collapsible navigation bar
    │       ├── SpecComplianceAgent.jsx # Submittal verification UI
    │       ├── ScheduleRiskEngine.jsx  # CPM Gantt & risk simulation sliders
    │       ├── SupplyChainAgent.jsx    # GIS shipment tracker & alternate rerouting
    │       ├── CommissioningCopilot.jsx# Level 1-5 checklist & certificate generator
    │       └── RfiKnowledgeAgent.jsx   # RAG chat assistant UI
    ├── package.json
    └── postcss.config.mjs
```

---

## Getting Started (Local Setup Guide)

### Prerequisites
* **Python**: 3.11 or higher
* **Node.js**: v18.0.0 or higher
* **Google Gemini API Key** (Set as `GEMINI_API_KEY` in environment variables)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/anshuS1310/EPC-Data_Centre.git
cd EPC-Data_Centre
```

---

### Step 2: Set Up Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv epcv

# Windows PowerShell:
.\epcv\Scripts\Activate.ps1

# Linux / macOS:
# source epcv/bin/activate

# Install dependencies
pip install fastapi uvicorn kuzu chromadb google-genai python-dotenv pydantic requests

# Create .env file for Gemini API Key
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env

# Run the FastAPI server
python main.py
```

*The backend server will start at `http://127.0.0.1:8000` and automatically seed KuzuDB with default WBS tasks and equipment schemas.*

---

### Step 3: Set Up Frontend

Open a new terminal window:

```bash
cd aegis-epc

# Install dependencies
npm install

# Run the development server
npm run dev
```

*Open [http://localhost:3000](http://localhost:3000) in your browser to launch the DCIMS platform.*

---

## Key Platform Features & Workflows

1. **Multi-Site Switching**: Switch seamlessly between *Navi Mumbai DC-1 (300 MW)*, *Noida Data Park-3 (150 MW)*, and *Hinjawadi Edge-5 (50 MW)* from the top header bar.
2. **Stress Test Sliders**: Adjust *Monsoon Severity* and *Labor Shortage Index* in the Schedule tab to observe live CPM float erosion and financial risk exposure updates.
3. **Automated Submittal Extraction**: Upload layout drawing images or select quick test scenarios to test auto-extraction of rear clearances and piping lengths.
4. **Supply Chain Rerouting**: Select any delayed shipment on the map (e.g. *PO-MUM-2026-004*) and click **"Reroute via Alternate Supplier"** to automatically bypass Tier-2 component delays in KuzuDB.
5. **Digital Certificate Generation**: Complete Level 1–4 commissioning checks and generate an official, Uptime Institute-audited acceptance certificate.

---

## License & Author

Developed as an advanced engineering project for Next-Generation Data Centre EPC Infrastructure Intelligence.

* **Author**: Anshu Singh
* **Repository**: [https://github.com/anshuS1310/EPC-Data_Centre](https://github.com/anshuS1310/EPC-Data_Centre)
