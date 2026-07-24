from db.graph_db import get_db_connection, db_lock

STANDARD_ITEMS = {
    "L1-01": {"description": "Verify Generator set outline drawing matches model submittal (A029E093/A029U550).", "default_status": "PASS", "default_val": "A029U550"},
    "L1-02": {"description": "Test Generator output at 100% continuous electrical load (1000 kW continuous output).", "default_status": "PASS", "default_val": "1000 kWe"},
    "L1-03": {"description": "Check NOx emissions dry value does not exceed standard 0.5 g/hp-h.", "default_status": "PASS", "default_val": "0.48 g/hp-h"},
    "L1-04": {"description": "Verify Vertiv CRV+ compressor model uses approved DC Brushless scroll compressor.", "default_status": "PASS", "default_val": "R-410A Brushless"},
    "L2-01": {"description": "Check Vertiv CRV+ nameplate matches requested cooling capacity (e.g., 38.1 kW for CR035).", "default_status": "PASS", "default_val": "38.1 kW"},
    "L2-02": {"description": "Verify physical space clearance around Vertiv CRV+ complies with minimum 600mm front and rear limits.", "default_status": "PENDING", "default_val": ""},
    "L2-03": {"description": "Inspect Generator battery capacity matches minimum requirement (720 AH at 40°C).", "default_status": "PASS", "default_val": "720 AH"},
    "L2-04": {"description": "Verify UPS batteries are stored in a ventilated, temperature-regulated space to prevent VRLA degradation.", "default_status": "PASS", "default_val": "22°C Room"},
    "L3-01": {"description": "Start Vertiv CRV+ indoor fan and verify airflow speed modulation works up to 100% capacity.", "default_status": "PASS", "default_val": "5540 m3/h"},
    "L3-02": {"description": "Test Generator gas supply pressure at engine inlet matches standard 0.2 bar (2.9 psi).", "default_status": "PASS", "default_val": "0.22 bar"},
    "L3-03": {"description": "Verify cooling circuit HT water outlet temperature remains within standard 90°C.", "default_status": "PASS", "default_val": "89.5°C"},
    "L3-04": {"description": "Verify cooling circuit LT water inlet temperature matches standard 40°C.", "default_status": "PASS", "default_val": "40.2°C"},
    "L4-01": {"description": "Simulate utility grid power loss and verify Generator starts and picks up 100% load within 10 seconds.", "default_status": "PENDING", "default_val": ""},
    "L4-02": {"description": "Test Liebert CROSS Static Transfer Switch (STS) failover time between dual feeds under load (must be < 6ms).", "default_status": "PENDING", "default_val": ""},
    "L4-03": {"description": "Measure rack return air temperatures at hot aisle to ensure rear rPDUs do not exceed maximum 60°C rating.", "default_status": "PENDING", "default_val": ""},
    "L4-04": {"description": "Verify continuous cooling loop operates during complete power system swap without temperature spike.", "default_status": "PENDING", "default_val": ""},
    "L5-01": {"description": "Assemble all Level 1-4 completed test records into the final as-commissioned Tier certification binder.", "default_status": "PENDING", "default_val": ""},
    "L5-02": {"description": "Verify DPDP compliance consent manager auditing is fully activated in the data center database infrastructure.", "default_status": "PENDING", "default_val": ""},
    "L5-03": {"description": "Baseline final engineering parameters to the DCIM system for long-term SLA monitoring.", "default_status": "PENDING", "default_val": ""}
}

class CommissioningAgent:
    """
    Agent 4: Commissioning & Quality Assurance Copilot.
    Manages BICSI Level 1-5 checklist state verification and generates acceptance certificates.
    """
    def __init__(self):
        pass

    def get_checklist_by_levels(self) -> list:
        """
        Queries KuzuDB for all CxProcedures and groups them under Levels 1-5.
        """
        conn = get_db_connection()
        res = conn.execute("MATCH (c:CxProcedure) RETURN c.id, c.description, c.status, c.verified_val, c.level")
        
        levels = {
            "Level 1": {"level": "Level 1", "name": "Factory Acceptance Testing (FAT)", "description": "Verification of equipment specifications and performance at the manufacturer's factory prior to shipment.", "checklist": []},
            "Level 2": {"level": "Level 2", "name": "Component Verification / Site Arrival", "description": "Inspection of equipment upon arrival at site to verify zero damage and matches spec sheets.", "checklist": []},
            "Level 3": {"level": "Level 3", "name": "System Operational Testing (SOT)", "description": "Verification that individual systems start up, run, and operate within nominal boundaries.", "checklist": []},
            "Level 4": {"level": "Level 4", "name": "Integrated Systems Testing (IST)", "description": "Full simulation of blackout and system failovers to verify Tier III/IV compliance under load.", "checklist": []},
            "Level 5": {"level": "Level 5", "name": "Handover & baseline documentation", "description": "Exporting final quality checklist packages and digital twins to DCIM operations.", "checklist": []}
        }

        # Seed local dictionary from KuzuDB entries
        db_items = {}
        while res.has_next():
            cid, desc, status, val, lvl = res.get_next()
            db_items[cid] = {"id": cid, "description": desc, "status": status, "verified_value": val}

        # Compile standard checklists with live KuzuDB states
        for item_id, std_info in STANDARD_ITEMS.items():
            db_item = db_items.get(item_id, {})
            status = db_item.get("status") or std_info["default_status"]
            desc = db_item.get("description") if (db_item.get("description") and db_item.get("description").strip()) else std_info["description"]
            val = db_item.get("verified_value") if (db_item.get("verified_value") is not None and db_item.get("verified_value") != "") else (std_info["default_val"] if status == "PASS" else None)
            
            lvl_key = f"Level {item_id[1]}"
            if lvl_key in levels:
                levels[lvl_key]["checklist"].append({
                    "id": item_id,
                    "description": desc,
                    "status": status,
                    "verified_value": val
                })

        return list(levels.values())

    def toggle_checklist_item(self, level: str, item_id: str) -> dict:
        """
        Toggles check item status. Blocked at Level 4 if generator rating NCR is active in KuzuDB.
        """
        conn = get_db_connection()

        # 1. Validation constraint check: Generator Prime rating NCR blocks Level 4 blackout test
        if level == "Level 4" and item_id == "L4-01":
            ncr_chk = conn.execute("MATCH (n:NonConformance {spec_clause: 'Uptime-Tier-III-Genset', status: 'OPEN'}) RETURN n.id")
            if ncr_chk.has_next():
                return {
                    "success": False,
                    "error_msg": "BLOCKED: Cannot pass Level 4 Blackout start test while the Generator Prime Rating NCR is OPEN."
                }

        # 2. Clearance constraint check: Clearance NCR blocks Level 2 check
        if level == "Level 2" and item_id == "L2-02":
            ncr_chk = conn.execute("MATCH (n:NonConformance {spec_clause: 'Vertiv-Clearance', status: 'OPEN'}) RETURN n.id")
            if ncr_chk.has_next():
                return {
                    "success": False,
                    "error_msg": "BLOCKED: Cannot pass Level 2 Clearance checks while the Vertiv CRV+ Clearance NCR is OPEN."
                }

        # 3. Piping constraint check: Piping NCR blocks Level 4 Return Air check
        if level == "Level 4" and item_id == "L4-03":
            ncr_chk = conn.execute("MATCH (n:NonConformance {spec_clause: 'Vertiv-CRV+-PipingLimit', status: 'OPEN'}) RETURN n.id")
            if ncr_chk.has_next():
                return {
                    "success": False,
                    "error_msg": "BLOCKED: Cannot pass Level 4 Return Air checks while the Vertiv Piping Limit NCR is OPEN."
                }

        # Determine current state and target status cleanly
        std_item = STANDARD_ITEMS.get(item_id, {"description": "Commissioning check", "default_status": "PENDING", "default_val": ""})
        
        res = conn.execute(f"MATCH (c:CxProcedure {{id: '{item_id}'}}) RETURN c.status")
        if res.has_next():
            curr_status = res.get_next()[0]
        else:
            curr_status = std_item["default_status"]

        new_status = "PASS" if curr_status == "PENDING" else "PENDING"
        new_val = std_item["default_val"] if new_status == "PASS" else ""
        item_desc = std_item["description"].replace("'", "''")

        with db_lock:
            chk_exist = conn.execute(f"MATCH (c:CxProcedure {{id: '{item_id}'}}) RETURN c.id")
            if not chk_exist.has_next():
                conn.execute(f"CREATE (c:CxProcedure {{id: '{item_id}', description: '{item_desc}', status: '{new_status}', verified_val: '{new_val}', level: '{level}'}});")
            else:
                conn.execute(f"MATCH (c:CxProcedure {{id: '{item_id}'}}) SET c.status = '{new_status}', c.verified_val = '{new_val}', c.description = '{item_desc}';")

        return {
            "success": True,
            "id": item_id,
            "status": new_status,
            "verified_value": new_val
        }

    def compile_certificate(self, project_id: str) -> dict:
        """
        Compiles Level 1-4 metrics and generates the acceptance certificate metadata.
        """
        conn = get_db_connection()
        
        open_ncr_chk = conn.execute("MATCH (n:NonConformance {status: 'OPEN'}) RETURN count(*)")
        ncr_count = open_ncr_chk.get_next()[0] if open_ncr_chk.has_next() else 0

        project_name = "Navi Mumbai Hyperscale DC-1"
        city = "Mumbai"
        tier = "Tier IV"
        if "NOI" in project_id:
            project_name = "Noida Green Data Park-3"
            city = "Delhi NCR"
            tier = "Tier III"

        status = "CERTIFIED" if ncr_count == 0 else "LOCKED (OPEN NCRS)"

        return {
            "project_name": project_name,
            "city": city,
            "tier_rating": tier,
            "commissioning_standard": "BICSI 002-2024 / TIA-942-C",
            "status": status,
            "date": "2026-07-23",
            "signatures": ["Lead Commissioning Engineer", "Uptime Institute Assessor"]
        }
