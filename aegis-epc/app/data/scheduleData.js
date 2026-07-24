/**
 * AegisEPC Schedule Data & Primavera WBS Mappings
 * Source: Primavera P6 WBS Template (PA-construction-wbs-templates -1.xer)
 */

export const PRIMAVERA_WBS_NODES = [
  { id: 49792, code: "Office Fitout", name: "Office Fitout Contract WBS", parent_id: null },
  { id: 49793, code: "10", name: "General", parent_id: 49792, duration_days: 15 },
  { id: 49794, code: "30", name: "Authority Approval phase", parent_id: 49792, duration_days: 45 },
  { id: 49795, code: "1", name: "Floor 1 - Approvals", parent_id: 49794, duration_days: 30 },
  { id: 49796, code: "1", name: "Landlord Approval", parent_id: 49795, duration_days: 15 },
  { id: 49797, code: "2", name: "Civil defense", parent_id: 49795, duration_days: 20 },
  { id: 49798, code: "3", name: "Dubai Municipality", parent_id: 49795, duration_days: 30 },
  { id: 49799, code: "4", name: "Floor 8 - Approvals", parent_id: 49794, duration_days: 30 },
  { id: 49800, code: "2", name: "Civil defense", parent_id: 49799, duration_days: 20 },
  { id: 49801, code: "1", name: "Landlord Approval", parent_id: 49799, duration_days: 15 },
  { id: 49802, code: "3", name: "Dubai Municipality", parent_id: 49799, duration_days: 30 },
  { id: 49803, code: "40", name: "Procurement Phase", parent_id: 49792, duration_days: 120 },
  { id: 49804, code: "60", name: "Constuction Phase", parent_id: 49792, duration_days: 180 },
  { id: 49805, code: "1", name: "Floor 8 Construction", parent_id: 49804, duration_days: 120 },
  { id: 49827, code: "10", name: "Preliminary Works", parent_id: 49805, duration_days: 10 },
  { id: 49808, code: "20", name: "MEP Works", parent_id: 49805, duration_days: 60 },
  { id: 49811, code: "10", name: "HVAC Works", parent_id: 49808, duration_days: 45 },
  { id: 49809, code: "20", name: "Electrical Works", parent_id: 49808, duration_days: 50 },
  { id: 49810, code: "30", name: "Fire fighting & fire alarm works", parent_id: 49808, duration_days: 30 },
  { id: 49812, code: "1", name: "Water supply & drainage works", parent_id: 49808, duration_days: 25 },
  { id: 49807, code: "2", name: "ICT Works", parent_id: 49805, duration_days: 20 },
  { id: 49813, code: "30", name: "Fitout Works", parent_id: 49805, duration_days: 55 },
  { id: 49816, code: "01", name: "Civil Works", parent_id: 49813, duration_days: 40 },
  { id: 49817, code: "02", name: "Partition Works", parent_id: 49816, duration_days: 20 },
  { id: 49818, code: "03", name: "Ceiling Works", parent_id: 49816, duration_days: 15 },
  { id: 49819, code: "07", name: "Glass works", parent_id: 49816, duration_days: 10 },
  { id: 49820, code: "08", name: "Joinery", parent_id: 49813, duration_days: 25 },
  { id: 49821, code: "3", name: "Finishes", parent_id: 49813, duration_days: 30 },
  { id: 49822, code: "05", name: "Flooring Works", parent_id: 49821, duration_days: 15 },
  { id: 49823, code: "04", name: "Wall Finishes", parent_id: 49821, duration_days: 12 },
  { id: 49824, code: "1", name: "Roller Blinds", parent_id: 49821, duration_days: 5 },
  { id: 49825, code: "2", name: "Signage", parent_id: 49821, duration_days: 7 },
  { id: 49826, code: "3", name: "Ceiling finishes", parent_id: 49821, duration_days: 10 },
  { id: 49814, code: "11", name: "Testing & Commissioning", parent_id: 49813, duration_days: 30 },
  { id: 49806, code: "40", name: "Handover", parent_id: 49805, duration_days: 10 }
];

export const INDIAN_PROJECTS = {
  "PRJ-MUM-01": {
    name: "Navi Mumbai Hyperscale DC-1",
    target_capacity_mw: 300,
    current_capacity_mw: 150,
    city: "Mumbai",
    tier_rating: "Tier IV",
    daily_ld_penalty_inr: 1250000, // ₹12.5 Lakh
    base_duration_months: 18,
    start_date: "2026-01-15",
    current_delay_days: 0,
    labor_headcount_required: 150,
    labor_headcount_assigned: 135
  },
  "PRJ-NOI-02": {
    name: "Noida Green Data Park-3",
    target_capacity_mw: 150,
    current_capacity_mw: 0,
    city: "Delhi NCR",
    tier_rating: "Tier III",
    daily_ld_penalty_inr: 800000, // ₹8 Lakh
    base_duration_months: 24,
    start_date: "2026-03-01",
    current_delay_days: 5,
    labor_headcount_required: 120,
    labor_headcount_assigned: 90
  },
  "PRJ-PUN-03": {
    name: "Hinjawadi Edge Compute Node-5",
    target_capacity_mw: 50,
    current_capacity_mw: 15,
    city: "Pune",
    tier_rating: "Tier III",
    daily_ld_penalty_inr: 400000, // ₹4 Lakh
    base_duration_months: 12,
    start_date: "2026-05-10",
    current_delay_days: 0,
    labor_headcount_required: 60,
    labor_headcount_assigned: 58
  }
};

export const REGIONAL_LABOR_METRICS = {
  "Mumbai": { productivity_index: 0.85, shortage_percent: 15, delay_impact_multiplier: 1.2 }, // 15% shortage, slows construction
  "Delhi NCR": { productivity_index: 0.78, shortage_percent: 25, delay_impact_multiplier: 1.35 }, // 25% shortage
  "Pune": { productivity_index: 0.92, shortage_percent: 8, delay_impact_multiplier: 1.05 }
};
