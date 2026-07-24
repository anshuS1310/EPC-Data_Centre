from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class WbsTaskOut(BaseModel):
    id: int
    code: str
    name: str
    parent_id: Optional[int] = None
    duration_days: Optional[int] = None       # current (live/modified) duration
    base_duration: Optional[int] = None       # original baseline duration (immutable)
    early_start: Optional[int] = None
    early_finish: Optional[int] = None
    late_start: Optional[int] = None
    late_finish: Optional[int] = None
    total_float: Optional[int] = None
    is_critical: Optional[bool] = None
    status: str

class SpecCheckIn(BaseModel):
    model_name: str
    clearance_front_mm: int
    clearance_rear_mm: int
    piping_length_m: int
    generator_rating: str
    project_id: str

class ViolationDetail(BaseModel):
    param: str
    actual: str
    required: str
    severity: str
    desc: str
    triggerType: str

class CascadeStep(BaseModel):
    agent: str
    msg: str

class AlertCardOut(BaseModel):
    id: str
    type: str
    title: str
    originAgent: str
    description: str
    steps: List[CascadeStep]

class ValidationResultOut(BaseModel):
    model: str
    passed: bool
    violations: List[ViolationDetail]
    cascade_trace: Optional[AlertCardOut] = None

class OcrResultOut(BaseModel):
    extracted_clearance_mm: Optional[int] = None
    extracted_piping_length_m: Optional[int] = None
    extracted_model: Optional[str] = None
    extracted_rating: Optional[str] = None
    success: bool
    log: str

class NcrLogOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    spec_clause: str
    status: str
    rectification_cost_inr: int
    delay_impact_days: int
    affected_task_id: int

class ShipmentOut(BaseModel):
    id: str
    item_name: str
    po_number: str
    project_id: str
    cost_lakh: int
    tier1_supplier: str
    tier2_supplier: str
    tier2_status: str
    current_location: str
    coordinates: List[float]
    status: str
    promised_delivery_date: str
    projected_delivery_date: str

class RerouteIn(BaseModel):
    shipment_id: str
    alternative_supplier_name: str

class RerouteResultOut(BaseModel):
    success: bool
    new_status: str
    updated_delay_days: int

class ChatQueryIn(BaseModel):
    query: str
    project_id: str

class DuplicateRfiOut(BaseModel):
    id: str
    title: str
    description: str
    status: str
    resolution: str

class ChatResponseOut(BaseModel):
    response: str
    citation: Optional[str] = None
    duplicates: List[DuplicateRfiOut] = []

class ChecklistItemOut(BaseModel):
    id: str
    description: str
    status: str
    verified_value: Optional[str] = None

class CommissioningChecklistOut(BaseModel):
    level: str
    name: str
    description: str
    checklist: List[ChecklistItemOut]

class ChecklistToggleIn(BaseModel):
    level: str
    item_id: str

class ProjectIdIn(BaseModel):
    project_id: str

class CertificateOut(BaseModel):
    project_name: str
    city: str
    tier_rating: str
    commissioning_standard: str
    status: str
    date: str
    signatures: List[str]

class ScheduleImpactIn(BaseModel):
    monsoon_severity: float
    labor_shortage: float
    project_id: str
