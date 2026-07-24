/**
 * AegisEPC Engineering Specifications & Standards Schema
 * Source: Verified Industry Standards & Technical Catalogues (Uptime Institute, ASHRAE, TIA-942-C, Vertiv, DPDP Gazette)
 */

export const VERTIV_CRV_MODELS = {
  // DX (Direct Expansion) Models
  "CRD10": { type: "DX", cooling_capacity_kw: 11.9, airflow_m3h: 3200, weight_kg: 220, width_mm: 300, depth_mm: 1100, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR012": { type: "DX", cooling_capacity_kw: 13.6, airflow_m3h: 3500, weight_kg: 210, width_mm: 300, depth_mm: 1100, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR020RA": { type: "DX", cooling_capacity_kw: 24.2, airflow_m3h: 4170, weight_kg: 335, width_mm: 600, depth_mm: 1175, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR025RA": { type: "DX", cooling_capacity_kw: 22.5, airflow_m3h: 4000, weight_kg: 260, width_mm: 600, depth_mm: 1175, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR030RC": { type: "DX", cooling_capacity_kw: 39.2, airflow_m3h: 5900, weight_kg: 180, width_mm: 300, depth_mm: 1100, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR035": { type: "DX", cooling_capacity_kw: 37.7, airflow_m3h: 5540, weight_kg: 365, width_mm: 600, depth_mm: 1175, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  
  // CW (Chilled Water) Models
  "CR040": { type: "CW", cooling_capacity_kw: 46.6, airflow_m3h: 5650, weight_kg: 330, width_mm: 600, depth_mm: 1175, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR050": { type: "CW", cooling_capacity_kw: 57.9, airflow_m3h: 7410, weight_kg: 365, width_mm: 600, depth_mm: 1175, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR052": { type: "CW", cooling_capacity_kw: 54.0, airflow_m3h: 7200, weight_kg: 230, width_mm: 300, depth_mm: 1100, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 },
  "CR060RC": { type: "CW", cooling_capacity_kw: 57.0, airflow_m3h: 7758, weight_kg: 230, width_mm: 300, depth_mm: 1100, height_mm: 2000, max_pipe_length_m: 30, min_clearance_front_mm: 600, min_clearance_rear_mm: 600 }
};

export const UPTIME_TIER_STANDARDS = {
  "Tier I": {
    concurrent_maintainability: false,
    fault_tolerance: false,
    paths_electrical: 1,
    paths_mechanical: 1,
    fuel_storage_hours: 12,
    generator_rating_required: "Prime",
    continuous_cooling_required: false
  },
  "Tier II": {
    concurrent_maintainability: false,
    fault_tolerance: false,
    paths_electrical: 1,
    paths_mechanical: 1,
    fuel_storage_hours: 12,
    generator_rating_required: "Prime",
    continuous_cooling_required: false
  },
  "Tier III": {
    concurrent_maintainability: true,
    fault_tolerance: false,
    paths_electrical: 2, // 1 Active, 1 Alternate
    paths_mechanical: 2, // Multiple paths, only 1 active at a time
    fuel_storage_hours: 12,
    generator_rating_required: "Continuous", // ISO 8528-1 Continuous or Prime derated to 70%
    continuous_cooling_required: false
  },
  "Tier IV": {
    concurrent_maintainability: true,
    fault_tolerance: true,
    paths_electrical: 2, // Simultaneously Active
    paths_mechanical: 2, // Simultaneously Active, physically isolated (compartmentalized)
    fuel_storage_hours: 12,
    generator_rating_required: "Continuous",
    continuous_cooling_required: true // Must withstand any failure without return air temperature spikes
  }
};

export const ASHRAE_TIA_COOLING_GUIDELINES = {
  // ASHRAE Temperature classes
  recommended_temp_min: 18,
  recommended_temp_max: 27,
  
  // High-Density (Class H1) for high-density computing > 25 kW/rack (TIA-942-C)
  high_density_rack_threshold_kw: 25,
  class_h1_temp_min: 18,
  class_h1_temp_max: 22,
  
  // Rear PDU (rPDU) temperature rating limits
  rpdu_max_air_temp_rating_c: 60,
  
  // Liquid Cooling thresholds
  liquid_cooling_density_threshold_kw: 25, // Above 25kW, direct-to-chip or RDHx is highly recommended. Immersion cooling above 150kW.
  immersion_cooling_density_threshold_kw: 150
};

export const DPDP_RULES_2025 = {
  act_name: "Digital Personal Data Protection Act, 2023",
  rules_notification_date: "2025-11-13",
  gazette_publication_date: "2025-11-14",
  phased_compliance_months: 18,
  full_compliance_deadline: "2027-05-14", // 18 months from notification
  critical_requirements: [
    "Consent Manager integration mapping for all customer/resident data",
    "Sovereign cloud hosting (MeghRaj or local secure cloud) for Government and BFSI nodes",
    "On-demand data erasure rights implemented in database architectures",
    "Significant Data Fiduciaries must conduct annual independent data protection audits"
  ]
};

export const PROCUREMENT_BOTTLENECK_LEAD_TIMES = {
  "Substation Transformer": { lead_time_weeks: 260, supplier_alternatives: ["Bloom Energy SOFC Microgrid (BYOP)"] },
  "Medium-Voltage Switchgear": { lead_time_weeks: 52, supplier_alternatives: ["Schneider Prefabricated MV Skids"] },
  "PMIC Semiconductors": { lead_time_weeks: 23.7, supplier_alternatives: ["Helsinki/Zurich local depots"] },
  "UPS Systems": { lead_time_weeks: 24, supplier_alternatives: ["Liebert EXS", "Liebert NXC", "Liebert APM"] }
};
