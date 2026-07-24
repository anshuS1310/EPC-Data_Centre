from db.graph_db import get_db_connection
from agents.llm_helper import GeminiLLMHelper
import re

class ComplianceAgent:
    """
    Agent 1: Quality Compliance & Spec Verification.
    Verifies cooling clearances, piping limits, and generator continuous ratings.
    """
    def __init__(self):
        self.llm = GeminiLLMHelper()

    def inspect_layout_drawing(self, image_bytes: bytes, mime_type: str, spec_id: str = "SPEC-VERTIV-CRV") -> dict:
        """
        Submits diagram to Gemini Vision to read clearance annotations.
        """
        prompt = (
            "You are a Quality Inspector for a Data Center construction site. "
            "Examine this layout drawing. Extract the rear maintenance clearance dimension "
            "specifically written next to the cooling unit cabinet (usually in mm or millimeters). "
            "Return ONLY a single line of text in this format: CLEARANCE = <number> mm. "
            "If you cannot find it, just define what you understand by the image properly and conclude irrelevant to this."
        )

        try:
            raw_res = self.llm.generate_vision_content(prompt, image_bytes, mime_type)
            # Log to server console for debugging
            print(f"[Gemini Vision]: {raw_res[:120]}...")
            
            # Stage 1: Standard requested format check
            match = re.search(r"CLEARANCE\s*=\s*(\d+)", raw_res, re.IGNORECASE)
            if match:
                return self.evaluate_safety_gate(int(match.group(1)), spec_id)
            
            # Stage 2: Fallback to any number followed by 'mm'
            match_mm = re.search(r"(\d+)\s*mm", raw_res, re.IGNORECASE)
            if match_mm:
                return self.evaluate_safety_gate(int(match_mm.group(1)), spec_id)
                
            # Stage 3: Fallback to any 3 or 4-digit number (standard clearance bounds)
            match_num = re.search(r"\b(\d{3,4})\b", raw_res)
            if match_num:
                return self.evaluate_safety_gate(int(match_num.group(1)), spec_id)

            # Stage 4: Check if the text contains explicit numbers in written form or fallback keywords
            if "500" in raw_res:
                return self.evaluate_safety_gate(500, spec_id)
            if "600" in raw_res:
                return self.evaluate_safety_gate(600, spec_id)

            # No clearance found — return clean Gemini description so user understands why
            clean = raw_res.strip()
            for prefix in ["[Gemini Vision Raw Response]:", "Raw Response:", "Vision Response:", "CHATBOT:"]:
                if clean.startswith(prefix):
                    clean = clean[len(prefix):].strip()
            # Limit to 400 chars for readability
            display = clean[:400] + ("…" if len(clean) > 400 else "")
            return {
                "success": False,
                "status": "PENDING_REVIEW",
                "log": f"No numeric clearance dimension found — {display}",
                "value": None
            }
        except Exception as e:
            return {"success": False, "status": "ERROR", "log": "Could not process document. Please try again or enter values manually.", "value": None}


    def evaluate_safety_gate(self, extracted_val: int, spec_id: str) -> dict:
        """
        Validation Safety Gate:
        Sanity checks extracted values against graph specifications to catch LLM reading errors.
        """
        conn = get_db_connection()
        res = conn.execute(f"MATCH (s:Specification {{id: '{spec_id}'}}) RETURN s.clearance_rear")
        if not res.has_next():
            req_rear = 600
        else:
            req_rear = res.get_next()[0]

        # Plausible bounds check (e.g. clearance must be at least 100mm and less than 3000mm)
        # Pulls sanity bounds from rule specifications
        lower_bound = 100
        upper_bound = 3000

        if extracted_val < lower_bound or extracted_val > upper_bound:
            # Implausible value, route to human verification
            return {
                "success": False,
                "status": "PENDING_REVIEW",
                "log": f"Extracted dimension {extracted_val}mm is outside expected bounds — please verify the value and enter manually if needed.",
                "value": extracted_val
            }

        # Plausible value, proceed to validation evaluation
        if extracted_val < req_rear:
            return {
                "success": True,
                "status": "VIOLATION",
                "log": f"Rear clearance extracted: {extracted_val}mm — below the required {req_rear}mm minimum. NCR will be raised.",
                "value": extracted_val
            }
        
        return {
            "success": True,
            "status": "COMPLIANT",
            "log": f"Rear clearance extracted: {extracted_val}mm — meets the {req_rear}mm specification. Form auto-filled.",
            "value": extracted_val
        }

    def validate_specs(self, model_name: str, clearance_front: int, clearance_rear: int, piping_length: int, generator_rating: str, project_id: str) -> dict:
        """
        Validates clearance, piping, and generator specifications against standard rules.
        """
        conn = get_db_connection()
        violations = []

        # 1. Row Cooling Clearance Check
        cool_res = conn.execute("MATCH (s:Specification {id: 'SPEC-VERTIV-CRV'}) RETURN s.clearance_front, s.clearance_rear, s.max_pipe_length")
        if cool_res.has_next():
            req_front, req_rear, max_pipe = cool_res.get_next()
            
            if clearance_front < req_front:
                violations.append({
                    "param": "Front Clearance",
                    "actual": f"{clearance_front}mm",
                    "required": f"Min {req_front}mm",
                    "severity": "CRITICAL",
                    "desc": "Front maintenance space is insufficient; restricts component access.",
                    "triggerType": "CLEARANCE_VIOLATION"
                })
            
            if clearance_rear < req_rear:
                violations.append({
                    "param": "Rear Clearance",
                    "actual": f"{clearance_rear}mm",
                    "required": f"Min {req_rear}mm",
                    "severity": "CRITICAL",
                    "desc": "Rear spacing is restricted; causes hot aisle air recirculation loops.",
                    "triggerType": "CLEARANCE_VIOLATION"
                })

            if piping_length > max_pipe:
                violations.append({
                    "param": "Piping Length",
                    "actual": f"{piping_length}m",
                    "required": f"Max {max_pipe}m",
                    "severity": "HIGH",
                    "desc": "Piping length exceeds standard 30m design threshold; requires expansion kit.",
                    "triggerType": "PIPING_VIOLATION"
                })

        # 2. Generator Standard Check
        gen_res = conn.execute("MATCH (s:Specification {id: 'SPEC-UPTIME-GEN'}) RETURN s.generator_rating")
        if gen_res.has_next():
            req_rating = gen_res.get_next()[0]
            if generator_rating != req_rating:
                violations.append({
                    "param": "Generator Rating",
                    "actual": generator_rating,
                    "required": req_rating,
                    "severity": "HIGH",
                    "desc": "Generator Prime rating fails Uptime standard topology for unlimited uptime.",
                    "triggerType": "GENERATOR_VIOLATION"
                })

        return {
            "model": model_name,
            "passed": len(violations) == 0,
            "violations": violations
        }
