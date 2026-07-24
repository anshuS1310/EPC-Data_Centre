/**
 * AegisEPC RFI Knowledge & Change Logs Database
 * Source: AIA G716 RFIs, G701 Change Orders, and standard technical manuals.
 */

export const MOCK_RFIS = [
  {
    id: "RFI-2026-004",
    title: "Vertiv CRV+ clearance adjustment in server row B",
    description: "The structural columns in Server Row B restrict the rear clearance of the cooling unit to 500mm, whereas the manual specifies 600mm. Can we reduce the clearance?",
    spec_clause: "Vertiv-Clearance",
    status: "CLOSED",
    resolution: "REJECTED. A minimum clearance of 600mm front and rear is mandatory for maintenance airflow. The cabinet row must be shifted 100mm forward. Relocation logged under Change Order G701-02.",
    date: "2026-02-10",
    tags: ["clearance", "cooling", "Vertiv", "space"]
  },
  {
    id: "RFI-2026-015",
    title: "Generator prime rating for Tier III certification",
    description: "We are installing a Cummins C1000 N6C generator rated for Prime power. Can we use this rating for Uptime Tier III certification?",
    spec_clause: "Uptime-Tier-III-Genset",
    status: "CLOSED",
    resolution: "APPROVED WITH CONDITIONS. Uptime Institute restricts Prime ratings unless derated to 70% of continuous capability, OR certified by the manufacturer for unlimited run-hours. The generator will be derated to 700 kW for compliance checking.",
    date: "2026-03-05",
    tags: ["genset", "Uptime", "Tier III", "rating"]
  },
  {
    id: "RFI-2026-033",
    title: "Piping length limit extension for CR035 unit",
    description: "The distance from the indoor CR035 cooling unit to the outdoor condenser is 35 meters. Do we require extra components?",
    spec_clause: "Vertiv-CRV+-PipingLimit",
    status: "OPEN",
    resolution: "PENDING. Standard piping limit is 30m. Lengths between 30m-50m require a Vertiv Pipe Extension Kit, including a liquid line solenoid valve and vertical traps every 7.5m.",
    date: "2026-06-15",
    tags: ["piping", "cooling", "Vertiv", "valves"]
  }
];

export const MOCK_CHANGE_ORDERS = [
  {
    id: "G701-01",
    title: "Bloom Energy SOFC microgrid integration",
    description: "Incorporate a 5 MW Bloom Energy Solid Oxide Fuel Cell microgrid to bypass the 260-week substation transformer grid queue.",
    cost_impact_inr: 85000000, // ₹8.5 Crore
    schedule_impact_days: -180, // Saves 180 days from critical path
    status: "APPROVED",
    date: "2026-04-01"
  },
  {
    id: "G701-02",
    title: "Clearance adjustment structural change",
    description: "Shift Server Row B forward by 100mm to comply with Vertiv CRV+ 600mm rear clearance specifications.",
    cost_impact_inr: 2500000, // ₹25 Lakh (NCR Rectification Cost)
    schedule_impact_days: 5,
    status: "APPROVED",
    date: "2026-02-15"
  }
];
