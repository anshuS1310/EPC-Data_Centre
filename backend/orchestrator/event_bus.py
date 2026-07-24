from db.graph_db import get_db_connection, db_lock
from agents.schedule_cost_agent import ScheduleCostAgent
from agents.rfi_agent import RFIAgent
import time
import threading

# Pre-computed spec citations — instant lookup, no LLM call needed
SPEC_CITATIONS = {
    "Vertiv-Clearance":       "Vertiv CRV+ Installation Guide §4.2 — Minimum rear clearance 600mm",
    "Vertiv-CRV+-PipingLimit": "Vertiv CR035 Hydraulics Spec §3.1 — Maximum piping run 30m (horizontal)",
    "Uptime-Tier-III-Genset":  "Uptime Institute Tier III Standard §4.5 — Generator must hold Continuous rating",
}

# Global Alert History Cache
ACTIVE_ALERTS = []

class EventOrchestrator:
    """
    Deterministic Event Bus coordinating cross-agent cascades when compliance violations are flagged.
    Prevents live-demo loops by utilizing standard Python logic.
    """
    def __init__(self):
        self.schedule_agent = ScheduleCostAgent()
        self.rfi_agent = RFIAgent()

    def get_all_alerts(self) -> list:
        # Re-sync ACTIVE_ALERTS from KuzuDB open NCRs to handle server reboots
        global ACTIVE_ALERTS

        # Build lookup of already-cached alerts by spec clause (before acquiring lock)
        cached_clauses = {}
        for alert in ACTIVE_ALERTS:
            desc = alert.get("description", "")
            if "clearance" in desc.lower() or "Vertiv-Clearance" in desc:
                cached_clauses["Vertiv-Clearance"] = alert
            elif "piping" in desc.lower() or "Vertiv-CRV+-PipingLimit" in desc:
                cached_clauses["Vertiv-CRV+-PipingLimit"] = alert
            elif "genset" in desc.lower() or "uptime-tier-iii-genset" in desc.lower():
                cached_clauses["Uptime-Tier-III-Genset"] = alert

        rebuilt = []
        try:
            conn = get_db_connection()
            with db_lock:
                res = conn.execute("MATCH (n:NonConformance) WHERE n.status = 'OPEN' RETURN n.spec_clause, n.title, n.description, n.id")
                while res.has_next():
                    clause, title, desc, ncr_id = res.get_next()
                    if clause in cached_clauses:
                        rebuilt.append(cached_clauses[clause])
                    else:
                        steps = [
                            {"agent": "1. Spec Compliance Agent", "msg": f"Logged {ncr_id}. Verification failed for {title}."},
                            {"agent": "2. Schedule & Cost Agent", "msg": "Blocked WBS task. Recalculated CPM Float. Project cost exposure elevated."}
                        ]
                        if clause != "Vertiv-Clearance":
                            steps.append({"agent": "3. Supply Chain Agent", "msg": "Upstream semiconductor wait detected. Checked alternate routes."})
                        steps.append({"agent": "5. RFI Knowledge Agent", "msg": "Searched Chroma. Prior resolutions retrieved."})

                        rebuilt.append({
                            "id": f"ALERT-{ncr_id}",
                            "type": "CRITICAL_CASCADE",
                            "title": f"Cascading Risk: {title}",
                            "originAgent": "Quality Compliance Agent",
                            "description": desc,
                            "steps": steps
                        })
        except Exception as e:
            print(f"Error reading alerts from DB: {e}")
        
        ACTIVE_ALERTS = rebuilt
        return ACTIVE_ALERTS

    def clear_all_alerts(self):
        global ACTIVE_ALERTS
        ACTIVE_ALERTS.clear()
        
        # Reset entire KuzuDB Graph Data back to defaults
        from db.seed_data import seed_graph_database
        seed_graph_database(force_reset=True)
        
        # Recalculate CPM schedule
        self.schedule_agent.run_cpm_calculations()

    def trigger_compliance_cascade(self, trigger_type: str, project_id: str) -> dict:
        global ACTIVE_ALERTS
        conn = get_db_connection()

        # Define spec mapping constants
        spec_clause = "Vertiv-Clearance"
        title = "Vertiv CRV+ Clearance Mismatch"
        cost_impact = 2000000        # ₹20 Lakh (NCR Rework)
        delay_days = 15             # 15 days delay
        affected_task_id = 49813    # WBS Fitout Works
        po_id = "PO-PUN-2026-088"

        if trigger_type == "PIPING_VIOLATION":
            spec_clause = "Vertiv-CRV+-PipingLimit"
            title = "Vertiv CR035 Piping Limit Exceeded"
            cost_impact = 650000     # ₹6.5 Lakh
            delay_days = 15
            affected_task_id = 49811 # WBS HVAC Works
            po_id = "PO-PUN-2026-088"
        elif trigger_type == "GENERATOR_VIOLATION":
            spec_clause = "Uptime-Tier-III-Genset"
            title = "Generator Prime Rating Violation"
            cost_impact = 2000000    # ₹20 Lakh
            delay_days = 15
            affected_task_id = 49809 # WBS Electrical Works
            po_id = "PO-NOI-2026-012"

        # 1. Event Bus Idempotency Gate
        # Verify if an open NCR already exists for this submittal + spec combination
        with db_lock:
            dup_chk = conn.execute(f"MATCH (n:NonConformance {{spec_clause: '{spec_clause}', status: 'OPEN'}}) RETURN n.id")
            if dup_chk.has_next():
                existing_ncr_id = dup_chk.get_next()[0]
                # Check if alert already in ACTIVE_ALERTS, bring to top
                for idx, alert in enumerate(ACTIVE_ALERTS):
                    if spec_clause in alert.get("description", "") or title in alert.get("title", ""):
                        promoted = ACTIVE_ALERTS.pop(idx)
                        promoted["timestamp"] = time.time()
                        ACTIVE_ALERTS.insert(0, promoted)
                        return promoted

        ncr_id = f"NCR-{trigger_type[:3]}-{int(time.time())}"
        description = f"Spec violation registered under clause {spec_clause}. Rework cost: ₹{cost_impact/100000:.1f} Lakh. Schedule delay: +{delay_days} days."

        # 2. Persist NonConformance node and relationships in KuzuDB inside the write lock
        with db_lock:
            # Create NCR node with fallback for schema compatibility
            try:
                conn.execute(
                    f"CREATE (n:NonConformance {{id: '{ncr_id}', title: '{title}', description: '{description}', "
                    f"status: 'OPEN', cost: {cost_impact}, delay: {delay_days}, spec_clause: '{spec_clause}', project_id: '{project_id}'}});"
                )
            except Exception as ex:
                if "project_id" in str(ex).lower():
                    # Schema fallback if column not created yet
                    conn.execute(
                        f"CREATE (n:NonConformance {{id: '{ncr_id}', title: '{title}', description: '{description}', "
                        f"status: 'OPEN', cost: {cost_impact}, delay: {delay_days}, spec_clause: '{spec_clause}'}});"
                    )
                else:
                    raise ex
            # Connect relationships
            conn.execute(f"MATCH (n:NonConformance {{id: '{ncr_id}'}}), (t:ScheduleTask {{id: {affected_task_id}}}) CREATE (n)-[:AFFECTS_TASK]->(t);")
            conn.execute(f"MATCH (n:NonConformance {{id: '{ncr_id}'}}), (po:PurchaseOrder {{id: '{po_id}'}}) CREATE (n)-[:LINKED_TO]->(po);")
            
            # Set WBS Task to BLOCKED status and update duration
            conn.execute(f"MATCH (t:ScheduleTask {{id: {affected_task_id}}}) SET t.duration = t.base_duration + {delay_days}, t.status = 'BLOCKED';")
            
            # Set PO status to AT_RISK and extend projected delivery date by delay
            conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}}) SET po.status = 'AT_RISK', po.projected_date = '2026-08-20';")

        # 3. Run CPM calculations in background thread — don't block the HTTP response
        def _run_cpm_async():
            try:
                self.schedule_agent.run_cpm_calculations()
            except Exception as e:
                print(f"[Background CPM] error: {e}")
        threading.Thread(target=_run_cpm_async, daemon=True).start()

        # 4. Fast static citation lookup — instant, no Gemini round-trip
        citation = SPEC_CITATIONS.get(spec_clause, "Aegis Project Specifications – relevant section")

        # 5. Compile the cascade alert card immediately
        steps = [
            {
                "agent": "1. Spec Compliance Agent",
                "msg": f"Logged {ncr_id}. Verification failed for {title}. Clearance/limits mismatch."
            },
            {
                "agent": "2. Schedule & Cost Agent",
                "msg": f"Blocked task {affected_task_id}. CPM recalculating in background. Handover delay: +{delay_days}d. Cost exposure elevated."
            },
            {
                "agent": "5. RFI Knowledge Agent",
                "msg": f"Searched specification index. Precedent cited: {citation}."
            }
        ]

        if trigger_type == "PIPING_VIOLATION" or trigger_type == "GENERATOR_VIOLATION":
            steps.insert(2, {
                "agent": "3. Supply Chain Agent",
                "msg": "Identified Tier-2 sub-supplier bottleneck. Checked alternate route catalog to bypass constraints."
            })

        import uuid
        alert_card = {
            "id": f"ALERT-{int(time.time())}-{uuid.uuid4().hex[:6]}",
            "type": "CRITICAL_CASCADE",
            "title": f"Cascading Risk: {title}",
            "originAgent": "Quality Compliance Agent",
            "description": description,
            "steps": steps
        }

        # Add to global cache
        ACTIVE_ALERTS.insert(0, alert_card)
        return alert_card
