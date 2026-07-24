/**
 * AegisEPC Commissioning & Testing Protocols
 * Source: BICSI 002 Sec 16, TIA-942-C, Uptime Tier standards
 */

export const COMMISSIONING_LEVELS = {
  "Level 1": {
    name: "Factory Acceptance Testing (FAT)",
    description: "Verification of equipment specifications and performance at the manufacturer's factory prior to shipment.",
    checklist: [
      { id: "L1-01", description: "Verify Generator set outline drawing matches model submittal (A029E093/A029U550).", status: "PASS", verified_value: "A029U550" },
      { id: "L1-02", description: "Test Generator output at 100% continuous electrical load (1000 kW continuous output).", status: "PASS", verified_value: "1000 kWe" },
      { id: "L1-03", description: "Check NOx emissions dry value does not exceed standard 0.5 g/hp-h.", status: "PASS", verified_value: "0.48 g/hp-h" },
      { id: "L1-04", description: "Verify Vertiv CRV+ compressor model uses approved DC Brushless scroll compressor.", status: "PASS", verified_value: "R-410A Brushless" }
    ]
  },
  "Level 2": {
    name: "Component Verification / Site Arrival",
    description: "Inspection of equipment upon arrival at site to verify zero damage and matches spec sheets.",
    checklist: [
      { id: "L2-01", description: "Check Vertiv CRV+ nameplate matches requested cooling capacity (e.g., 38.1 kW for CR035).", status: "PASS", verified_value: "38.1 kW" },
      { id: "L2-02", description: "Verify physical space clearance around Vertiv CRV+ complies with minimum 600mm front and rear limits.", status: "PENDING", verified_value: null },
      { id: "L2-03", description: "Inspect Generator battery capacity matches minimum requirement (720 AH at 40°C).", status: "PASS", verified_value: "720 AH" },
      { id: "L2-04", description: "Verify UPS batteries are stored in a ventilated, temperature-regulated space to prevent VRLA degradation.", status: "PASS", verified_value: "22°C Room" }
    ]
  },
  "Level 3": {
    name: "System Operational Testing (SOT)",
    description: "Verification that individual systems start up, run, and operate within nominal boundaries.",
    checklist: [
      { id: "L3-01", description: "Start Vertiv CRV+ indoor fan and verify airflow speed modulation works up to 100% capacity.", status: "PASS", verified_value: "5540 m3/h" },
      { id: "L3-02", description: "Test Generator gas supply pressure at engine inlet matches standard 0.2 bar (2.9 psi).", status: "PASS", verified_value: "0.22 bar" },
      { id: "L3-03", description: "Verify cooling circuit HT water outlet temperature remains within standard 90°C.", status: "PASS", verified_value: "89.5°C" },
      { id: "L3-04", description: "Verify cooling circuit LT water inlet temperature matches standard 40°C.", status: "PASS", verified_value: "40.2°C" }
    ]
  },
  "Level 4": {
    name: "Integrated Systems Testing (IST)",
    description: "Full simulation of blackout and system failovers to verify Tier III/IV compliance under load.",
    checklist: [
      { id: "L4-01", description: "Simulate utility grid power loss and verify Generator starts and picks up 100% load within 10 seconds.", status: "PENDING", verified_value: null },
      { id: "L4-02", description: "Test Liebert CROSS Static Transfer Switch (STS) failover time between dual feeds under load (must be < 6ms).", status: "PENDING", verified_value: null },
      { id: "L4-03", description: "Measure rack return air temperatures at hot aisle to ensure rear rPDUs do not exceed maximum 60°C rating.", status: "PENDING", verified_value: null },
      { id: "L4-04", description: "Verify continuous cooling loop operates during complete power system swap without temperature spike.", status: "PENDING", verified_value: null }
    ]
  },
  "Level 5": {
    name: "Handover & baseline documentation",
    description: "Exporting final quality checklist packages and digital twins to DCIM operations.",
    checklist: [
      { id: "L5-01", description: "Assemble all Level 1-4 completed test records into the final as-commissioned Tier certification binder.", status: "PENDING", verified_value: null },
      { id: "L5-02", description: "Verify DPDP compliance consent manager auditing is fully activated in the data center database infrastructure.", status: "PENDING", verified_value: null },
      { id: "L5-03", description: "Baseline final engineering parameters to the DCIM system for long-term SLA monitoring.", status: "PENDING", verified_value: null }
    ]
  }
};
