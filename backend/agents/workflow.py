from typing import TypedDict, Optional, Dict, Any
from langgraph.graph import StateGraph, END
from agents.compliance_agent import ComplianceAgent
from parser.doc_ocr import DocOCRProcessor

# 1. Define Agent State structures
class ComplianceAgentState(TypedDict):
    file_path: str
    is_image: bool
    ocr_text: Optional[str]
    extracted_params: Dict[str, Any]
    validation_passed: bool
    log: str

# 2. Define Node Functions
def run_ocr_node(state: ComplianceAgentState) -> Dict[str, Any]:
    file_path = state["file_path"]
    is_image = state["is_image"]
    
    ocr = DocOCRProcessor()
    
    if is_image:
        # Check if we should pass to Vision directly or run text OCR
        ocr_res = ocr.ocr_image(file_path)
        return {"ocr_text": ocr_res, "log": "OCR completed successfully on layout image."}
    else:
        pdf_res = ocr.parse_pdf_layout(file_path)
        return {"ocr_text": pdf_res, "log": "Marker layout extraction completed successfully on PDF manual."}

def extract_and_validate_node(state: ComplianceAgentState) -> Dict[str, Any]:
    ocr_text = state.get("ocr_text", "")
    agent = ComplianceAgent()
    
    # Run mock regex parameter parsing from OCR text
    text_lower = ocr_text.lower()
    
    # Default values
    clearance_front = 650
    clearance_rear = 620
    piping_length = 25
    generator_rating = "Continuous"
    model = "CR035"

    if "rear" in text_lower or "clearance" in text_lower:
        # Check if contains numbers representing rear clearance
        import re
        match = re.search(r"rear\s*(?:clearance)?\s*=\s*(\d+)", text_lower)
        if match:
            clearance_rear = int(match.group(1))
            
    if "piping" in text_lower or "pipe" in text_lower:
        import re
        match = re.search(r"piping\s*(?:length)?\s*=\s*(\d+)", text_lower)
        if match:
            piping_length = int(match.group(1))

    if "prime" in text_lower:
        generator_rating = "Prime"

    # Run compliance rules evaluation
    val_res = agent.validate_specs(
        model_name=model,
        clearance_front=clearance_front,
        clearance_rear=clearance_rear,
        piping_length=piping_length,
        generator_rating=generator_rating,
        project_id="PRJ-MUM-01"
    )

    return {
        "extracted_params": {
            "clearance_front_mm": clearance_front,
            "clearance_rear_mm": clearance_rear,
            "piping_length_m": piping_length,
            "generator_rating": generator_rating,
            "model_name": model
        },
        "validation_passed": val_res["passed"],
        "log": f"Extracted and validated parameters. Passed: {val_res['passed']}"
    }

# 3. Scaffold LangGraph State Machine
def build_compliance_workflow():
    workflow = StateGraph(ComplianceAgentState)
    
    # Register Nodes
    workflow.add_node("run_ocr", run_ocr_node)
    workflow.add_node("extract_and_validate", extract_and_validate_node)
    
    # Set Entry Point and Edges
    workflow.set_entry_point("run_ocr")
    workflow.add_edge("run_ocr", "extract_and_validate")
    workflow.add_edge("extract_and_validate", END)
    
    # Compile
    return workflow.compile()
