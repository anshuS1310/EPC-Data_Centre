import chromadb
import os

CHROMA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db_data")

_chroma_client = None
_collection = None

def get_vector_db():
    global _chroma_client, _collection
    if _collection is None:
        if not os.path.exists(CHROMA_DIR):
            os.makedirs(CHROMA_DIR)
        
        # Initialize Persistent Client
        _chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = _chroma_client.get_or_create_collection(
            name="aegis_spec_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        seed_vector_knowledge(_collection)
    return _collection

def seed_vector_knowledge(collection):
    # Check if already seeded
    if collection.count() > 0:
        return

    print("Seeding Chroma Vector Database with standard specifications manuals...")

    documents = [
        # 1. Vertiv Clearances
        "Vertiv Liebert CRV+ User Manual - Section 2.2.2 (Space Requirements): "
        "The physical layout clearances for Liebert CRV and CRV+ series (models CR035, CRD10, CR020RA) "
        "require a minimum of 600 mm spacing in the front for maintenance access and 600 mm in the rear "
        "to ensure proper heat dissipation and airflow recirculation. Reducing rear spacing below 600 mm "
        "violates Vertiv standard warranty clearances and causes hot aisle recirculation loops.",

        # 2. Vertiv Piping Limits
        "Vertiv Liebert CRV+ User Manual - Section 2.3.5 (Piping Limits): "
        "Standard Direct Expansion (DX) cooling pipe connections are rated for a maximum equivalent length "
        "of 30 meters. Equivalent lengths exceeding 30 meters (up to 50 meters) require a Vertiv certified "
        "Pipe Extension Kit. This kit includes a liquid line solenoid valve, an oversized discharge line, "
        "and oil traps installed at least every 7.5 meters of vertical lift to ensure compressor lubrication.",

        # 3. Uptime Generator Ratings
        "Uptime Institute Tier Standard: Topology - Section 3.3 (Engine Generator Ratings): "
        "For Uptime Tier III and Tier IV certifications, on-site primary power generators must be rated "
        "for Continuous duty (ISO 8528-1 Continuous Power). Generators carrying only a Prime rating are "
        "restricted and must be derated to 70% of their nameplate prime capacity to satisfy unlimited "
        "run-hour requirements, unless supported by manufacturer validation for unlimited uptime.",

        # 4. DPDP Localization Rules
        "MeitY Digital Personal Data Protection (DPDP) Act Rules 2025 - Clause 4.3 (Data Localization): "
        "All personal data of Indian citizens, particularly sensitive financial (BFSI) and sovereign "
        "government information, must be hosted on local cloud nodes located physically within the borders of India. "
        "The MeitY Gazette published on Nov 14, 2025, grants a 18-month phased compliance window ending in "
        "May 2027 for all data fiduciaries to complete migration to local sovereign clouds.",

        # 5. ASHRAE Density limits
        "TIA-942-C / ASHRAE TC9.9 Thermal Guidelines - Section 8: "
        "Class H1 high-density cabinets (>25 kW per rack) require a recommended return air intake boundary of "
        "18 to 22 degrees Celsius. Standard air-cooled Row setups (like Vertiv CRV) are insufficient above "
        "25 kW per rack, and direct-to-chip liquid cooling or Rear Door Heat Exchangers (RDHx) are required."
    ]

    ids = [
        "spec-vertiv-clearance",
        "spec-vertiv-piping",
        "spec-uptime-genset",
        "spec-meity-dpdp",
        "spec-ashrae-density"
    ]

    metadatas = [
        {"source": "Vertiv Liebert CRV Manual", "section": "2.2.2", "tag": "clearance"},
        {"source": "Vertiv Liebert CRV Manual", "section": "2.3.5", "tag": "piping"},
        {"source": "Uptime Institute Topology Guidelines", "section": "3.3", "tag": "genset"},
        {"source": "MeitY DPDP Notification 2025", "section": "Clause 4.3", "tag": "dpdp"},
        {"source": "TIA-942-C / ASHRAE Guidelines", "section": "Section 8", "tag": "cooling"}
    ]

    collection.add(
        documents=documents,
        ids=ids,
        metadatas=metadatas
    )
    print("Chroma Vector Database Seeded successfully!")
