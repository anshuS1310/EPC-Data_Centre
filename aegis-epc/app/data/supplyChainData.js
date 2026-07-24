/**
 * AegisEPC Supply Chain Data & Shipments
 * Tracks Tier-1 assemblies and Tier-2 components down to supplier nodes.
 */

export const GLOBAL_SUPPLIERS = {
  "VERTIV-SHENZHEN": { name: "Vertiv Assembly Hub", location: "Shenzhen, China", coordinates: [22.54, 114.05], tier: 1 },
  "CUMMINS-INDIANA": { name: "Cummins Power Systems", location: "Columbus, Indiana, USA", coordinates: [39.20, -85.92], tier: 1 },
  "ABB-ZURICH": { name: "ABB MV Grid Solutions", location: "Zurich, Switzerland", coordinates: [47.37, 8.54], tier: 1 },
  "TSMC-HSINCHU": { name: "TSMC Foundry Fab 12", location: "Hsinchu, Taiwan", coordinates: [24.78, 120.96], tier: 2 },
  "INFINEON-MUNICH": { name: "Infineon Technologies", location: "Munich, Germany", coordinates: [48.13, 11.58], tier: 2 }
};

export const TRANSIT_NODES = {
  "JNPT-MUMBAI": { name: "Jawaharlal Nehru Port Trust", location: "Mumbai, India", coordinates: [18.95, 72.95] },
  "MUNDRA-PORT": { name: "Mundra Port Terminal", location: "Gujarat, India", coordinates: [22.84, 69.70] },
  "CHENNAI-PORT": { name: "Chennai Port Trust", location: "Chennai, India", coordinates: [13.09, 80.29] }
};

export const ACTIVE_SHIPMENTS = [
  {
    id: "SH-UPS-001",
    item_name: "Liebert Trinergy Cube 1200 kW UPS",
    po_number: "PO-MUM-2026-004",
    project_id: "PRJ-MUM-01",
    cost_lakh: 180, // ₹180 Lakh
    tier1_supplier: "VERTIV-SHENZHEN",
    tier2_supplier: "TSMC-HSINCHU", // Providing PMIC chips
    tier2_status: "DELAYED", // Semiconductor lead time constraint (23.7 weeks)
    current_location: "South China Sea",
    coordinates: [10.0, 110.0],
    route: ["VERTIV-SHENZHEN", "JNPT-MUMBAI", "PRJ-MUM-01"],
    status: "AT_RISK", // Delayed due to Tier-2 PMIC wait times
    departure_date: "2026-06-01",
    promised_delivery_date: "2026-07-28",
    projected_delivery_date: "2026-08-15" // 18 days delay
  },
  {
    id: "SH-GEN-002",
    item_name: "Cummins C1000 N6C Gas Generator",
    po_number: "PO-NOI-2026-012",
    project_id: "PRJ-NOI-02",
    cost_lakh: 220, // ₹220 Lakh
    tier1_supplier: "CUMMINS-INDIANA",
    tier2_supplier: "INFINEON-MUNICH",
    tier2_status: "ON_TIME",
    current_location: "Red Sea Transit",
    coordinates: [20.0, 38.0],
    route: ["CUMMINS-INDIANA", "MUNDRA-PORT", "PRJ-NOI-02"],
    status: "ON_TIME",
    departure_date: "2026-05-15",
    promised_delivery_date: "2026-08-10",
    projected_delivery_date: "2026-08-10"
  },
  {
    id: "SH-CRV-003",
    item_name: "Liebert CR035 Precision AC (38 kW)",
    po_number: "PO-PUN-2026-088",
    project_id: "PRJ-PUN-03",
    cost_lakh: 35, // ₹35 Lakh
    tier1_supplier: "VERTIV-SHENZHEN",
    tier2_supplier: "TSMC-HSINCHU",
    tier2_status: "ON_TIME",
    current_location: "Bay of Bengal",
    coordinates: [12.0, 85.0],
    route: ["VERTIV-SHENZHEN", "CHENNAI-PORT", "PRJ-PUN-03"],
    status: "ON_TIME",
    departure_date: "2026-06-10",
    promised_delivery_date: "2026-07-25",
    projected_delivery_date: "2026-07-25"
  }
];

export const PROCUREMENT_ALTERNATIVES = {
  "SH-UPS-001": [
    { supplier: "Siemens India Ltd", location: "Pune Hub", cost_lakh: 210, lead_time_weeks: 2, status: "AVAILABLE", note: "On-site backup stock available immediately; standard premium charge applies." }
  ],
  "Substation Transformer": [
    { supplier: "Bloom Energy (BYOP)", location: "Hyderabad Plant", cost_lakh: 850, lead_time_weeks: 12, status: "AVAILABLE", note: "Solid Oxide Fuel Cell islanded microgrid bypasses central grid substation queues entirely." }
  ]
};
