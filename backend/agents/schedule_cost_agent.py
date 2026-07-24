from db.graph_db import get_db_connection, db_lock
import collections

class ScheduleCostAgent:
    """
    Agent 2: Schedule & Cost Risk Engine.
    Implements a full CPM (Critical Path Method) Forward and Backward Pass solver
    to compute Early Start/Finish, Late Start/Finish, and Total Float per task.
    """
    def __init__(self):
        pass

    def run_cpm_calculations(self) -> dict:
        """
        Retrieves ScheduleTask graph nodes and DEPENDS_ON edges from KuzuDB,
        executes CPM Forward/Backward passes, and updates parameters back to KuzuDB.
        """
        conn = get_db_connection()
        
        # 1. Fetch all tasks
        res = conn.execute("MATCH (t:ScheduleTask) RETURN t.id, t.duration, t.base_duration, t.name")
        tasks = []
        durations = {}
        names = {}
        while res.has_next():
            tid, dur, base_dur, name = res.get_next()
            # If duration is NULL (WBS header), treat duration as 0 for CPM math
            dur_val = int(dur) if dur is not None else 0
            tasks.append(tid)
            durations[tid] = dur_val
            names[tid] = name

        # 2. Fetch dependencies
        # (succ)-[:DEPENDS_ON]->(pred) means successor depends on predecessor
        dep_res = conn.execute("MATCH (s:ScheduleTask)-[:DEPENDS_ON]->(p:ScheduleTask) RETURN s.id, p.id")
        
        # Build graphs
        successors = collections.defaultdict(list)
        predecessors = collections.defaultdict(list)
        in_degree = {t: 0 for t in tasks}

        while dep_res.has_next():
            succ, pred = dep_res.get_next()
            successors[pred].append(succ)
            predecessors[succ].append(pred)
            in_degree[succ] += 1

        # 3. Topological Sort (Kahn's Algorithm)
        queue = collections.deque([t for t in tasks if in_degree[t] == 0])
        topo_order = []
        
        while queue:
            node = queue.popleft()
            topo_order.append(node)
            for succ in successors[node]:
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    queue.append(succ)

        # Handle cyclical fallback if any
        if len(topo_order) < len(tasks):
            remaining = set(tasks) - set(topo_order)
            topo_order.extend(list(remaining))

        # 4. Forward Pass (Compute ES and EF)
        es = {}
        ef = {}
        for node in topo_order:
            if not predecessors[node]:
                es[node] = 0
            else:
                es[node] = max(ef[p] for p in predecessors[node])
            ef[node] = es[node] + durations[node]

        # Project Finish Date (PF)
        project_finish = max(ef.values()) if ef else 0

        # 5. Backward Pass (Compute LF and LS)
        lf = {}
        ls = {}
        for node in reversed(topo_order):
            if not successors[node]:
                lf[node] = project_finish
            else:
                lf[node] = min(ls[s] for s in successors[node])
            ls[node] = lf[node] - durations[node]

        # 6. Compute Total Float & Critical Path Flag
        tf = {}
        is_critical = {}
        for node in tasks:
            tf[node] = ls[node] - es[node]
            # Float equal to 0 signifies critical path
            is_critical[node] = (tf[node] == 0)

        # 7. Persist CPM outputs back to KuzuDB inside the write lock
        with db_lock:
            for node in tasks:
                crit_str = "true" if is_critical[node] else "false"
                query = (
                    f"MATCH (t:ScheduleTask {{id: {node}}}) "
                    f"SET t.es = {es[node]}, t.ef = {ef[node]}, "
                    f"t.ls = {ls[node]}, t.lf = {lf[node]}, "
                    f"t.tf = {tf[node]}, t.is_critical = {crit_str}"
                )
                conn.execute(query)

        return {
            "project_finish_days": project_finish,
            "tasks_count": len(tasks),
            "critical_path_tasks": [t for t in tasks if is_critical[t]]
        }

    def compute_cost_risk(self, project_id: str) -> dict:
        """
        Calculates project financial risk dynamically based on current delay and active NCR rework.
        """
        conn = get_db_connection()
        
        # 1. Fetch project properties (name, daily LD penalty)
        # Mock fetch from projects catalog or seed
        daily_ld = 1250000 # Default ₹12.5 Lakh for Navi Mumbai
        if "NOI" in project_id:
            daily_ld = 800000
        elif "PUN" in project_id:
            daily_ld = 400000

        # 2. Get active WBS tasks completion delay
        # Compare current EF of Handover task (id: 49806) to its base EF
        # Calculate Base Project Finish
        res = conn.execute("MATCH (t:ScheduleTask) RETURN t.id, t.duration, t.base_duration")
        curr_fin = 0
        base_fin = 0
        
        # For simplicity, calculate difference in finish date (EF of Handover task 49806)
        res_ef = conn.execute("MATCH (t:ScheduleTask {id: 49806}) RETURN t.ef, t.base_duration")
        if res_ef.has_next():
            ef_val, base_dur = res_ef.get_next()
            curr_fin = ef_val
        
        # If no CPM has run yet, default delay to 0
        delay_days = max(0, curr_fin - 225) # Base project length is 225 days

        # 3. Sum active NCR costs linked to this project
        ncr_res = conn.execute("MATCH (n:NonConformance {status: 'OPEN'}) RETURN n.cost")
        rework_cost = 0
        while ncr_res.has_next():
            rework_cost += ncr_res.get_next()[0]

        # 4. Check active shipments surcharges
        # Surcharges logged if shipments are status 'AT_RISK'
        ship_res = conn.execute(f"MATCH (po:PurchaseOrder {{status: 'AT_RISK'}}) RETURN count(*)")
        shipping_surcharge = 0
        if ship_res.has_next():
            at_risk_count = ship_res.get_next()[0]
            shipping_surcharge = at_risk_count * 650000 # ₹6.5 Lakh premium air freight surcharge

        # 5. Execute formula
        total_risk = (delay_days * daily_ld) + rework_cost + shipping_surcharge

        return {
            "delay_days": delay_days,
            "rework_cost_inr": rework_cost,
            "shipping_surcharge_inr": shipping_surcharge,
            "daily_ld_penalty_inr": daily_ld,
            "total_risk_exposure_inr": total_risk
        }

    def update_schedule_modifiers(self, monsoon: float, labor: float):
        """
        Adjusts task durations dynamically based on weather/labor sliders.
        - Outdoor construction tasks are extended.
        """
        conn = get_db_connection()
        
        # Fetch tasks and base durations
        res = conn.execute("MATCH (t:ScheduleTask) RETURN t.id, t.base_duration, t.name")
        tasks_to_update = []
        while res.has_next():
            tid, base_dur, name = res.get_next()
            if base_dur is not None:
                tasks_to_update.append((tid, base_dur, name))
                
        with db_lock:
            for tid, base_dur, name in tasks_to_update:
                weather_factor = 0.0
                labor_factor = 0.0
                
                name_lower = name.lower()
                # Apply modifier for outdoor MEP, Preliminary and Fitout works
                if any(x in name_lower for x in ["preliminary", "hvac", "electrical", "fitout", "construction"]):
                    weather_factor = monsoon * 0.4  # Max 40% extension
                    labor_factor = labor * 0.3      # Max 30% extension
                
                # Check if task is currently blocked by NCR to add NCR delay
                ncr_chk = conn.execute(f"MATCH (n:NonConformance {{status: 'OPEN'}})-[:AFFECTS_TASK]->(t:ScheduleTask {{id: {tid}}}) RETURN n.delay")
                ncr_delay = 0
                if ncr_chk.has_next():
                    ncr_delay = ncr_chk.get_next()[0]

                # Compute new duration
                modified_dur = base_dur + int(base_dur * (weather_factor + labor_factor)) + ncr_delay
                
                # Update task duration in KuzuDB
                conn.execute(f"MATCH (t:ScheduleTask {{id: {tid}}}) SET t.duration = {modified_dur};")
        
        # Re-run CPM calculations
        self.run_cpm_calculations()
