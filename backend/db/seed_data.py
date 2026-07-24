from db.graph_db import get_db_connection, db_lock
import os

# WBS Nodes from Primavera Parser Mock
SEED_WBS_NODES = [
  {"id": 49792, "code": "Office Fitout", "name": "Office Fitout Contract WBS", "duration_days": None},
  {"id": 49793, "code": "10", "name": "General", "duration_days": 15},
  {"id": 49794, "code": "30", "name": "Authority Approval phase", "duration_days": None},
  {"id": 49795, "code": "1", "name": "Floor 1 - Approvals", "duration_days": None},
  {"id": 49796, "code": "1", "name": "Landlord Approval", "duration_days": 15},
  {"id": 49797, "code": "2", "name": "Civil defense", "duration_days": 20},
  {"id": 49798, "code": "3", "name": "Dubai Municipality", "duration_days": 30},
  {"id": 49799, "code": "4", "name": "Floor 8 - Approvals", "duration_days": None},
  {"id": 49800, "code": "2", "name": "Civil defense", "duration_days": 20},
  {"id": 49801, "code": "1", "name": "Landlord Approval", "duration_days": 15},
  {"id": 49802, "code": "3", "name": "Dubai Municipality", "duration_days": 30},
  {"id": 49803, "code": "40", "name": "Procurement Phase", "duration_days": 120},
  {"id": 49804, "code": "60", "name": "Constuction Phase", "duration_days": None},
  {"id": 49805, "code": "1", "name": "Floor 8 Construction", "duration_days": None},
  {"id": 49827, "code": "10", "name": "Preliminary Works", "duration_days": 10},
  {"id": 49808, "code": "20", "name": "MEP Works", "duration_days": None},
  {"id": 49811, "code": "10", "name": "HVAC Works", "duration_days": 45},
  {"id": 49809, "code": "20", "name": "Electrical Works", "duration_days": 50},
  {"id": 49810, "code": "30", "name": "Fire fighting & fire alarm works", "duration_days": 30},
  {"id": 49812, "code": "1", "name": "Water supply & drainage works", "duration_days": 25},
  {"id": 49807, "code": "2", "name": "ICT Works", "duration_days": 20},
  {"id": 49813, "code": "30", "name": "Fitout Works", "duration_days": 55},
  {"id": 49816, "code": "01", "name": "Civil Works", "duration_days": 40},
  {"id": 49817, "code": "02", "name": "Partition Works", "duration_days": 20},
  {"id": 49818, "code": "03", "name": "Ceiling Works", "duration_days": 15},
  {"id": 49819, "code": "07", "name": "Glass works", "duration_days": 10},
  {"id": 49820, "code": "08", "name": "Joinery", "duration_days": 25},
  {"id": 49821, "code": "3", "name": "Finishes", "duration_days": None},
  {"id": 49822, "code": "05", "name": "Flooring Works", "duration_days": 15},
  {"id": 49823, "code": "04", "name": "Wall Finishes", "duration_days": 12},
  {"id": 49824, "code": "1", "name": "Roller Blinds", "duration_days": 5},
  {"id": 49825, "code": "2", "name": "Signage", "duration_days": 7},
  {"id": 49826, "code": "3", "name": "Ceiling finishes", "duration_days": 10},
  {"id": 49814, "code": "11", "name": "Testing & Commissioning", "duration_days": 30},
  {"id": 49806, "code": "40", "name": "Handover", "duration_days": 10}
]

# CPM Dependency edges (Predecessor -> Successor)
# Reworked to represent a single valid path
SEED_CPM_DEPENDENCIES = [
    (49793, 49796), # General -> Floor 1 Landlord Approval
    (49793, 49801), # General -> Floor 8 Landlord Approval
    (49796, 49797), # Floor 1 Landlord -> Civil Defense
    (49801, 49800), # Floor 8 Landlord -> Civil Defense
    (49797, 49798), # Floor 1 Civil Defense -> Dubai Municipality
    (49800, 49802), # Floor 8 Civil Defense -> Dubai Municipality
    (49798, 49803), # Dubai Municipality -> Procurement Phase
    (49802, 49803), # Dubai Municipality -> Procurement Phase
    (49803, 49827), # Procurement -> Preliminary Works
    (49827, 49811), # Preliminary Works -> HVAC Works
    (49827, 49809), # Preliminary Works -> Electrical Works
    (49827, 49810), # Preliminary Works -> Fire Fighting
    (49827, 49812), # Preliminary Works -> Water supply
    (49811, 49813), # HVAC -> Fitout
    (49809, 49813), # Electrical -> Fitout
    (49813, 49814), # Fitout -> Testing & Commissioning
    (49814, 49806)  # Testing & Commissioning -> Handover
]

def seed_graph_database(force_reset: bool = True):
    conn = get_db_connection()
    
    with db_lock:
        if force_reset:
            print("Force resetting KuzuDB Graph Data to defaults...")
            try:
                conn.execute("MATCH (n) DETACH DELETE n;")
            except Exception as e:
                print(f"Error clearing database: {e}")
        else:
            # Check if already seeded
            res = conn.execute("MATCH (p:Specification) RETURN count(*)")
            count = res.get_next()[0]
            if count > 0:
                return

        print("Seeding KuzuDB Graph Data...")

        # 1. Seed Specifications
        conn.execute("CREATE (s:Specification {id: 'SPEC-VERTIV-CRV', clearance_front: 600, clearance_rear: 600, max_pipe_length: 30, generator_rating: 'Continuous'});")
        conn.execute("CREATE (s:Specification {id: 'SPEC-UPTIME-GEN', clearance_front: 0, clearance_rear: 0, max_pipe_length: 0, generator_rating: 'Continuous'});")

        # 2. Seed SubSuppliers (Tier-2)
        conn.execute("CREATE (su:SubSupplier {id: 'SUB-TSMC', name: 'TSMC Taiwan', component: 'PMIC Chips', lead_time_weeks: 23.7, status: 'DELAYED'});")
        conn.execute("CREATE (su:SubSupplier {id: 'SUB-INFINEON', name: 'Infineon Munich', component: 'Medium-Voltage Switchgear', lead_time_weeks: 8.0, status: 'ON_TIME'});")

        # 3. Seed Purchase Orders
        conn.execute("CREATE (po:PurchaseOrder {id: 'PO-MUM-2026-004', item_name: 'Liebert Trinergy Cube 1200 kW UPS', cost_lakh: 180, status: 'AT_RISK', promised_date: '2026-07-28', projected_date: '2026-08-15'});")
        conn.execute("CREATE (po:PurchaseOrder {id: 'PO-NOI-2026-012', item_name: 'Cummins C1000 N6C Gas Generator', cost_lakh: 220, status: 'ON_TIME', promised_date: '2026-08-10', projected_date: '2026-08-10'});")
        conn.execute("CREATE (po:PurchaseOrder {id: 'PO-PUN-2026-088', item_name: 'Liebert CR035 Precision AC', cost_lakh: 35, status: 'ON_TIME', promised_date: '2026-07-25', projected_date: '2026-07-25'});")

        # Connect POs to SubSuppliers
        conn.execute("MATCH (po:PurchaseOrder {id: 'PO-MUM-2026-004'}), (su:SubSupplier {id: 'SUB-TSMC'}) CREATE (po)-[:DEPENDS_ON_COMPONENT]->(su);")
        conn.execute("MATCH (po:PurchaseOrder {id: 'PO-NOI-2026-012'}), (su:SubSupplier {id: 'SUB-INFINEON'}) CREATE (po)-[:DEPENDS_ON_COMPONENT]->(su);")

        # 4. Seed RFIs
        conn.execute("CREATE (r:RFI {id: 'RFI-2026-004', title: 'Vertiv CRV+ clearance adjustment in server row B', description: 'The structural columns restrict the rear clearance of the cooling unit to 500mm, whereas the manual specifies 600mm.', status: 'CLOSED', resolution: 'REJECTED. A minimum clearance of 600mm front/rear is mandatory for maintenance. Shifting row forward 100mm approved under Change Order G701-02.', tags: 'clearance space'});")
        conn.execute("CREATE (r:RFI {id: 'RFI-2026-015', title: 'Generator prime rating for Tier III certification', description: 'Can we install a Cummins C1000 N6C rated for Prime power for Tier III?', status: 'CLOSED', resolution: 'APPROVED WITH CONDITIONS. Restricted unless derated to 70% of continuous rating (700 kW).', tags: 'genset rating'});")
        conn.execute("CREATE (r:RFI {id: 'RFI-2026-033', title: 'Piping length limit extension for CR035 unit', description: 'The distance to the outdoor condenser is 35m. Do we require extra components?', status: 'OPEN', resolution: 'PENDING. Standard piping limit is 30m. Lengths between 30m-50m require a Vertiv Pipe Extension Kit, including a liquid line solenoid valve and vertical traps every 7.5m.', tags: 'piping cooling'});")

        # 5. Seed Schedule Tasks (WBS)
        for task in SEED_WBS_NODES:
            duration = task["duration_days"]
            dur_str = str(duration) if duration is not None else "NULL"
            base_dur_str = str(duration) if duration is not None else "NULL"
            
            query = f"CREATE (t:ScheduleTask {{id: {task['id']}, code: '{task['code']}', name: '{task['name']}', duration: {dur_str}, base_duration: {base_dur_str}, status: 'ON_TIME', es: 0, ef: 0, ls: 0, lf: 0, tf: 0, is_critical: false}});"
            conn.execute(query)

        # Connect WBS tasks dependencies
        for pred_id, succ_id in SEED_CPM_DEPENDENCIES:
            conn.execute(f"MATCH (p:ScheduleTask {{id: {pred_id}}}), (s:ScheduleTask {{id: {succ_id}}}) CREATE (s)-[:DEPENDS_ON]->(p);")

        # Connect POs to corresponding WBS Tasks
        # PO-MUM-004 fits WBS task 49809 (Electrical Works)
        conn.execute("MATCH (po:PurchaseOrder {id: 'PO-MUM-2026-004'}), (t:ScheduleTask {id: 49809}) CREATE (po)-[:FULFILLS_WBS]->(t);")
        # PO-NOI-012 fits WBS task 49809 (Electrical Works)
        conn.execute("MATCH (po:PurchaseOrder {id: 'PO-NOI-2026-012'}), (t:ScheduleTask {id: 49809}) CREATE (po)-[:FULFILLS_WBS]->(t);")
        # PO-PUN-088 fits WBS task 49811 (HVAC Works)
        conn.execute("MATCH (po:PurchaseOrder {id: 'PO-PUN-2026-088'}), (t:ScheduleTask {id: 49811}) CREATE (po)-[:FULFILLS_WBS]->(t);")

        # 6. Seed Commissioning Procedures
        # Seed checks for Level 1, 2, 3, 4, 5
        conn.execute("CREATE (c:CxProcedure {id: 'L1-01', description: 'Verify Generator set outline drawing matches model submittal.', status: 'PASS', verified_val: 'A029U550', level: 'Level 1'});")
        conn.execute("CREATE (c:CxProcedure {id: 'L2-02', description: 'Verify physical space clearance around Vertiv CRV+ complies with minimum 600mm front and rear limits.', status: 'PENDING', verified_val: '', level: 'Level 2'});")
        conn.execute("CREATE (c:CxProcedure {id: 'L4-01', description: 'Simulate utility grid power loss and verify Generator starts and picks up 100% load within 10 seconds.', status: 'PENDING', verified_val: '', level: 'Level 4'});")

        # Connect Cx Procedures to POs
        conn.execute("MATCH (c:CxProcedure {id: 'L1-01'}), (po:PurchaseOrder {id: 'PO-NOI-2026-012'}) CREATE (c)-[:TESTS]->(po);")
        conn.execute("MATCH (c:CxProcedure {id: 'L2-02'}), (po:PurchaseOrder {id: 'PO-PUN-2026-088'}) CREATE (c)-[:TESTS]->(po);")
        conn.execute("MATCH (c:CxProcedure {id: 'L4-01'}), (po:PurchaseOrder {id: 'PO-NOI-2026-012'}) CREATE (c)-[:TESTS]->(po);")

        print("KuzuDB Graph Database Seeded successfully!")

if __name__ == "__main__":
    seed_graph_database()
