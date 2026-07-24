from db.graph_db import get_db_connection, db_lock

class SupplyChainAgent:
    """
    Agent 3: Supply Chain Visibility & Alternate Supplier Routing.
    Tracks Tier-1 PO shipments and Tier-2 upstream component sub-suppliers.
    """
    def __init__(self):
        pass

    def get_active_shipments(self) -> list:
        """
        Queries KuzuDB to get active Purchase Orders and their multi-tier sub-supplier dependencies.
        """
        conn = get_db_connection()
        query = (
            "MATCH (po:PurchaseOrder)-[:DEPENDS_ON_COMPONENT]->(su:SubSupplier) "
            "RETURN po.id, po.item_name, po.cost_lakh, po.status, po.promised_date, po.projected_date, "
            "su.id, su.name, su.component, su.lead_time_weeks, su.status"
        )
        res = conn.execute(query)
        shipments = []
        
        while res.has_next():
            row = res.get_next()
            po_id, item_name, cost, po_status, promised, projected, su_id, su_name, comp, lead_time, su_status = row
            
            # Map coordinates — precise geographic [lat, lng] for each shipment origin
            # PO-MUM-2026-004: JNPT (Jawaharlal Nehru Port, Nhava Sheva) inbound — currently in South China Sea
            # PO-NOI-2026-012: Jebel Ali, Dubai (Red Sea transit to Mundra Port)
            # PO-PUN-2026-088: Chennai Port (domestic coastal transit)
            if po_id == "PO-MUM-2026-004":
                coords = [17.10, 113.85]   # South China Sea (near Paracel Islands) — in transit
            elif po_id == "PO-NOI-2026-012":
                coords = [25.01, 55.06]    # Jebel Ali Port, Dubai (UAE)
            else:
                coords = [13.08, 80.30]    # Chennai Port, Tamil Nadu


            shipments.append({
                "id": po_id,
                "item_name": item_name,
                "po_number": f"PO-{po_id[-12:]}",
                "project_id": "PRJ-MUM-01" if "MUM" in po_id else "PRJ-NOI-02" if "NOI" in po_id else "PRJ-PUN-03",
                "cost_lakh": cost,
                "tier1_supplier": "Vertiv Hub" if "MUM" in po_id or "PUN" in po_id else "Cummins Hub",
                "tier2_supplier": su_name,
                "tier2_status": su_status,
                "current_location": "South China Sea" if po_id == "PO-MUM-2026-004" else "Red Sea Transit",
                "coordinates": coords,
                "status": po_status,
                "promised_delivery_date": promised,
                "projected_delivery_date": projected
            })
        return shipments

    def get_alternatives(self, po_id: str) -> list:
        """
        Returns pre-certified alternate supplier routes if a PO has Tier-2 risk.
        """
        if po_id == "PO-MUM-2026-004":
            return [{
                "name": "Alt-Vendor B (Pune Depot)",
                "component": "1200 kW UPS replacement stock",
                "cost_lakh": 210,
                "lead_time_weeks": 2.0,
                "note": "Pre-certified on-site backup stock is available; bypasses TSMC PMIC wait."
            }]
        return []

    def reroute_po(self, po_id: str, alternate_name: str) -> bool:
        """
        Reroutes a PurchaseOrder from a delayed Tier-2 supplier to a pre-certified alternate supplier.
        Modifies KuzuDB relationships dynamically under the write lock.
        """
        conn = get_db_connection()
        
        with db_lock:
            # 1. Verify PO exists
            chk = conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}}) RETURN po.id")
            if not chk.has_next():
                return False

            # 2. Delete existing SOURCED_FROM / DEPENDS_ON edge
            conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}})-[r:DEPENDS_ON_COMPONENT]->(su:SubSupplier) DELETE r;")

            # 3. Create a new SubSupplier node for the alternate vendor if not exists
            alt_id = "SUB-ALT-PUNE"
            alt_chk = conn.execute(f"MATCH (s:SubSupplier {{id: '{alt_id}'}}) RETURN s.id")
            if not alt_chk.has_next():
                conn.execute(f"CREATE (su:SubSupplier {{id: '{alt_id}', name: '{alternate_name}', component: 'UPS replacement', lead_time_weeks: 2.0, status: 'ON_TIME'}});")

            # 4. Connect PO to the new sub-supplier
            conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}}), (su:SubSupplier {{id: '{alt_id}'}}) CREATE (po)-[:DEPENDS_ON_COMPONENT]->(su);")

            # 5. Reset PO status to ON_TIME and project projected date equal to promised date
            # Since lead time drops from 23.7 weeks to 2 weeks, we save the delay!
            conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}}) SET po.status = 'ON_TIME', po.projected_date = po.promised_date;")

            # 6. Locate associated WBS task and reset status to ON_TIME
            task_res = conn.execute(f"MATCH (po:PurchaseOrder {{id: '{po_id}'}})-[:FULFILLS_WBS]->(t:ScheduleTask) RETURN t.id")
            if task_res.has_next():
                task_id = task_res.get_next()[0]
                conn.execute(f"MATCH (t:ScheduleTask {{id: {task_id}}}) SET t.status = 'ON_TIME';")

        return True
