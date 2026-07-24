import kuzu
import os
import threading
import time
import atexit
import signal
import sys

# Scoped Concurrency Lock for KuzuDB Single-Process Engine
db_lock = threading.Lock()

# DB Directory path
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kuzu_db_data")

# Global Connection
_db = None
_conn = None


def close_db_connection():
    """
    Cleanly closes the KuzuDB connection and releases the OS file lock.
    Called on graceful shutdown AND registered with atexit so it runs even on crashes.
    """
    global _db, _conn
    try:
        if _conn is not None:
            _conn = None
            print("KuzuDB connection released.")
        if _db is not None:
            _db = None
            print("KuzuDB database closed cleanly.")
    except Exception as e:
        print(f"Warning: error while closing KuzuDB: {e}")


# Register cleanup to run automatically on any Python exit (Ctrl+C, crash, SIGTERM, etc.)
atexit.register(close_db_connection)


def get_db_connection():
    global _db, _conn
    with db_lock:
        if _conn is None:
            # Retry for up to 30 seconds (30 attempts × 1s) to handle leftover lock from a crashed process
            max_attempts = 30
            for attempt in range(max_attempts):
                try:
                    _db = kuzu.Database(DB_DIR)
                    _conn = kuzu.Connection(_db)
                    init_db_schema(_conn)
                    break
                except Exception as e:
                    err_str = str(e).lower()
                    if "lock" in err_str and attempt < max_attempts - 1:
                        print(f"KuzuDB lock busy — retrying in 1s (attempt {attempt + 1}/{max_attempts})...")
                        time.sleep(1)
                    else:
                        print(f"KuzuDB initialization failed after {attempt + 1} attempts: {e}")
                        raise e
        return _conn


def init_db_schema(conn):
    # Check if tables exist
    tables = []
    try:
        res = conn.execute("CALL show_tables() RETURN *;")
        while res.has_next():
            row = res.get_next()
            if len(row) > 1:
                tables.append(row[1])
    except Exception:
        pass

    # Create Node Tables (only if they do not exist)
    if "Specification" not in tables:
        conn.execute("CREATE NODE TABLE Specification(id STRING, clearance_front INT, clearance_rear INT, max_pipe_length INT, generator_rating STRING, PRIMARY KEY(id));")
    if "PurchaseOrder" not in tables:
        conn.execute("CREATE NODE TABLE PurchaseOrder(id STRING, item_name STRING, cost_lakh INT, status STRING, promised_date STRING, projected_date STRING, PRIMARY KEY(id));")
    if "VendorSubmittal" not in tables:
        conn.execute("CREATE NODE TABLE VendorSubmittal(id STRING, file_name STRING, parsed_dims STRING, PRIMARY KEY(id));")
    if "ScheduleTask" not in tables:
        conn.execute("CREATE NODE TABLE ScheduleTask(id INT64, code STRING, name STRING, duration INT64, base_duration INT64, status STRING, es INT64, ef INT64, ls INT64, lf INT64, tf INT64, is_critical BOOLEAN, PRIMARY KEY(id));")
    if "CxProcedure" not in tables:
        conn.execute("CREATE NODE TABLE CxProcedure(id STRING, description STRING, status STRING, verified_val STRING, level STRING, PRIMARY KEY(id));")
    if "RFI" not in tables:
        conn.execute("CREATE NODE TABLE RFI(id STRING, title STRING, description STRING, status STRING, resolution STRING, tags STRING, PRIMARY KEY(id));")
    if "NonConformance" not in tables:
        conn.execute("CREATE NODE TABLE NonConformance(id STRING, title STRING, description STRING, status STRING, cost INT64, delay INT64, spec_clause STRING, project_id STRING, PRIMARY KEY(id));")
    else:
        try:
            conn.execute("ALTER TABLE NonConformance ADD project_id STRING DEFAULT 'PRJ-MUM-01';")
        except Exception:
            pass
    if "SubSupplier" not in tables:
        conn.execute("CREATE NODE TABLE SubSupplier(id STRING, name STRING, component STRING, lead_time_weeks DOUBLE, status STRING, PRIMARY KEY(id));")

    # Create Relationship Tables (only if they do not exist)
    if "VALIDATES_SPEC" not in tables:
        conn.execute("CREATE REL TABLE VALIDATES_SPEC(FROM VendorSubmittal TO Specification);")
    if "FULFILLS_WBS" not in tables:
        conn.execute("CREATE REL TABLE FULFILLS_WBS(FROM PurchaseOrder TO ScheduleTask);")
    if "AFFECTS_TASK" not in tables:
        conn.execute("CREATE REL TABLE AFFECTS_TASK(FROM NonConformance TO ScheduleTask);")
    if "VIOLATES" not in tables:
        conn.execute("CREATE REL TABLE VIOLATES(FROM NonConformance TO Specification);")
    if "LINKED_TO" not in tables:
        conn.execute("CREATE REL TABLE LINKED_TO(FROM NonConformance TO PurchaseOrder);")
    if "CITED_FOR" not in tables:
        conn.execute("CREATE REL TABLE CITED_FOR(FROM RFI TO NonConformance);")
    if "TESTS" not in tables:
        conn.execute("CREATE REL TABLE TESTS(FROM CxProcedure TO PurchaseOrder);")
    if "DEPENDS_ON_COMPONENT" not in tables:
        conn.execute("CREATE REL TABLE DEPENDS_ON_COMPONENT(FROM PurchaseOrder TO SubSupplier);")
    if "DEPENDS_ON" not in tables:
        conn.execute("CREATE REL TABLE DEPENDS_ON(FROM ScheduleTask TO ScheduleTask);")

    print("KuzuDB Graph Schema checked / initialized successfully!")
