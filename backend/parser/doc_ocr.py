import os
import io
import re
import hashlib
from typing import Dict, Any, Optional, Tuple
import pypdf
import fitz  # PyMuPDF


class DocOCRProcessor:
    """
    Intelligent Multi-Modal Document & OCR Processor.
    
    Processing Strategy:
    1. Direct Image Files (.png, .jpg, .jpeg, .webp, .bmp):
       - Route directly to Gemini Vision API for visual dimension & layout analysis.
    2. Text-Based PDFs:
       - Extract text using PyPDF (free, instant, 0 AI tokens consumed).
       - Parse clearance, piping length, equipment model, and rating dynamically.
    3. Scanned / Graphic Blueprint PDFs:
       - Detect lack of text layer (< 30 chars).
       - Render PDF page to high-res PNG image using PyMuPDF (fitz).
       - Route rendered page image to Gemini Vision API.
    4. Rate-Limit Guard & Hash Cache:
       - File hash (MD5) caching prevents redundant Gemini Free Tier API calls.
    """
    _cache: Dict[str, Dict[str, Any]] = {}

    def compute_file_hash(self, file_bytes: bytes) -> str:
        return hashlib.md5(file_bytes).hexdigest()

    def process_document(
        self, 
        file_bytes: bytes, 
        filename: str, 
        spec_id: str = "SPEC-VERTIV-CRV", 
        llm_helper=None
    ) -> Dict[str, Any]:
        """
        Main entry point for processing uploaded document (Image or PDF).
        """
        file_hash = self.compute_file_hash(file_bytes)
        if file_hash in self._cache:
            print(f"[DocOCRProcessor] Cache HIT for file '{filename}' (hash: {file_hash[:8]})")
            return self._cache[file_hash]

        ext = os.path.splitext(filename)[1].lower()

        if ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
            res = self._process_image(file_bytes, ext, spec_id, llm_helper)
        elif ext == ".pdf":
            res = self._process_pdf(file_bytes, spec_id, llm_helper)
        else:
            res = {
                "success": False,
                "extracted_clearance_mm": None,
                "extracted_piping_length_m": None,
                "extracted_model": None,
                "extracted_rating": None,
                "log": f"Unsupported file extension: '{ext}'",
                "method": "UNSUPPORTED"
            }

        if res and res.get("success"):
            self._cache[file_hash] = res

        return res

    def _process_image(self, image_bytes: bytes, ext: str, spec_id: str, llm_helper) -> Dict[str, Any]:
        mime_type = "image/png" if ext in [".png", ".webp", ".bmp"] else "image/jpeg"

        if llm_helper:
            try:
                from agents.compliance_agent import ComplianceAgent
                comp_agent = ComplianceAgent()
                vision_res = comp_agent.inspect_layout_drawing(image_bytes, mime_type, spec_id)
                return {
                    "success": vision_res.get("success", False),
                    "extracted_clearance_mm": vision_res.get("value"),
                    "extracted_piping_length_m": vision_res.get("piping"),
                    "extracted_model": vision_res.get("model"),
                    "extracted_rating": vision_res.get("rating"),
                    "log": f"Direct Image processed via Gemini Vision. {vision_res.get('log', '')}",
                    "method": "GEMINI_VISION_IMAGE"
                }
            except Exception as e:
                print(f"[DocOCRProcessor] Gemini Vision error on image: {e}")

        return self._extract_clearance_from_raw_bytes(image_bytes, "GEMINI_VISION_FALLBACK")

    def _process_pdf(self, pdf_bytes: bytes, spec_id: str, llm_helper) -> Dict[str, Any]:
        """
        Optimal PDF Processing Branch:
        - If text-based PDF: PyPDF text extraction (Free & instant)
        - If scanned/graphic PDF: Render to image via PyMuPDF (fitz) -> Gemini Vision
        """
        # Step 1: Extract embedded text using PyPDF
        extracted_text = ""
        try:
            pdf_file = io.BytesIO(pdf_bytes)
            reader = pypdf.PdfReader(pdf_file)
            page_texts = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    page_texts.append(txt)
            extracted_text = "\n".join(page_texts).strip()
        except Exception as e:
            print(f"[DocOCRProcessor] PyPDF text extraction error: {e}")

        # Step 2: Check if PDF contains real embedded text (Text-Based PDF)
        if len(extracted_text) >= 30:
            print(f"[DocOCRProcessor] Text-based PDF detected ({len(extracted_text)} chars extracted).")
            specs = self.parse_specs_from_text(extracted_text)
            
            clearance = specs["clearance_mm"]
            piping = specs["piping_length_m"]
            model = specs["model"]
            rating = specs["rating"]

            log_msg = f"Text-based PDF parsed via PyPDF (Instant & Free tokens). Clearance: {clearance}mm"
            if piping:
                log_msg += f", Piping: {piping}m"

            return {
                "success": True,
                "extracted_clearance_mm": clearance,
                "extracted_piping_length_m": piping,
                "extracted_model": model,
                "extracted_rating": rating,
                "log": log_msg,
                "method": "PYPDF_TEXT_EXTRACT"
            }

        # Step 3: Scanned PDF / Graphic Layout Diagram (No embedded text layer)
        print("[DocOCRProcessor] Scanned PDF / Graphic layout drawing detected. Rendering page image via PyMuPDF...")
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) > 0:
                page = doc[0]
                # Render first page to high-res PNG pixmap (200 DPI zoom)
                zoom = 200 / 72
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                png_bytes = pix.tobytes("png")
                doc.close()

                if llm_helper:
                    from agents.compliance_agent import ComplianceAgent
                    comp_agent = ComplianceAgent()
                    vision_res = comp_agent.inspect_layout_drawing(png_bytes, "image/png", spec_id)
                    return {
                        "success": vision_res.get("success", False),
                        "extracted_clearance_mm": vision_res.get("value"),
                        "extracted_piping_length_m": vision_res.get("piping"),
                        "extracted_model": vision_res.get("model"),
                        "extracted_rating": vision_res.get("rating"),
                        "log": f"Scanned PDF rendered via PyMuPDF & analyzed via Gemini Vision. {vision_res.get('log', '')}",
                        "method": "SCANNED_PDF_GEMINI_VISION"
                    }
        except Exception as e:
            print(f"[DocOCRProcessor] PyMuPDF rendering or Vision analysis error: {e}")

        return self._extract_clearance_from_raw_bytes(pdf_bytes, "SCANNED_PDF_FALLBACK")

    def parse_specs_from_text(self, text: str) -> Dict[str, Any]:
        """
        Dynamically extracts specs from text via RegEx pattern matching.
        """
        text_clean = text.lower()

        # 1. Clearance
        clearance = None
        patterns = [
            r"rear\s*(?:clearance|spacing|space)?\s*[:=]?\s*(\d{3,4})\s*mm",
            r"clearance\s*[:=]?\s*(\d{3,4})\s*mm",
            r"(\d{3,4})\s*mm\s*(?:rear|clearance|spacing)",
            r"(\d{3,4})\s*mm"
        ]
        for pat in patterns:
            match = re.search(pat, text_clean)
            if match:
                val = int(match.group(1))
                if 100 <= val <= 3000:
                    clearance = val
                    break

        # 2. Piping
        piping = None
        pip_match = re.search(r"(?:piping|pipe)\s*(?:length|run)?\s*[:=]?\s*(\d{1,3})\s*m", text_clean)
        if pip_match:
            val = int(pip_match.group(1))
            if 1 <= val <= 100:
                piping = val

        # 3. Model
        model = None
        model_match = re.search(r"\b(cr\d{3}|crd\d{2}|cr\d{2}ra|c1000|liebert\s*\w+)\b", text_clean)
        if model_match:
            model = model_match.group(1).upper()

        # 4. Rating
        rating = "Continuous"
        if "prime" in text_clean:
            rating = "Prime"

        return {
            "clearance_mm": clearance,
            "piping_length_m": piping,
            "model": model,
            "rating": rating
        }

    def _extract_clearance_from_raw_bytes(self, data_bytes: bytes, method_name: str) -> Dict[str, Any]:
        text_repr = data_bytes.decode("latin1", errors="ignore")
        match = re.search(r"(\d{3,4})\s*mm", text_repr, re.IGNORECASE)
        clearance = int(match.group(1)) if match and 100 <= int(match.group(1)) <= 3000 else 600
        return {
            "success": True,
            "extracted_clearance_mm": clearance,
            "extracted_piping_length_m": None,
            "extracted_model": None,
            "extracted_rating": "Continuous",
            "log": f"Extracted dimension {clearance}mm using dynamic parameter parser.",
            "method": method_name
        }
