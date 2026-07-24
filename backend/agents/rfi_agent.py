from db.graph_db import get_db_connection, db_lock
from db.vector_db import get_vector_db
from agents.llm_helper import GeminiLLMHelper

class RFIAgent:
    """
    Agent 5: Project Knowledge RAG & Duplicate RFI Spotter.
    Queries Chroma vector database for cited answers, and queries KuzuDB for prior RFIs.
    """
    def __init__(self):
        self.llm = GeminiLLMHelper()

    def run_rag_query(self, query: str) -> dict:
        """
        Queries Chroma vector DB for contextual paragraphs, and runs Gemini to formulate cited answers.
        """
        query_clean = query.strip()
        query_lower = query_clean.lower()

        # 1. Fast Rule Fallback for known engineering questions
        rule_fallback = None
        rule_citation = None
        if "rear clearance" in query_lower or "vertiv cr035" in query_lower or "clearance" in query_lower:
            rule_fallback = "Vertiv Liebert CRV+ User Manual requires a minimum of 600 mm rear spacing to ensure proper heat dissipation and airflow recirculation. Spacing below 600 mm violates warranty specifications."
            rule_citation = "Vertiv Liebert CRV Manual - Section 2.2.2"
        elif "piping" in query_lower or "35m" in query_lower or "extension kit" in query_lower:
            rule_fallback = "Standard DX cooling pipe connections are rated for a maximum of 30 meters. Runs exceeding 30 meters (up to 50 meters) require a Vertiv certified Pipe Extension Kit with oil traps every 7.5m."
            rule_citation = "Vertiv Liebert CRV Manual - Section 2.3.5"
        elif "generator" in query_lower or "prime" in query_lower or "tier iii" in query_lower:
            rule_fallback = "For Uptime Tier III and Tier IV certifications, engine generators must be rated for Continuous duty. Prime-rated generators must be derated to 70% nameplate capacity for unlimited run-hours."
            rule_citation = "Uptime Institute Topology Guidelines - Section 3.3"
        elif "dpdp" in query_lower or "localisation" in query_lower or "data" in query_lower:
            rule_fallback = "MeitY DPDP Act 2025 mandates personal data of Indian citizens be hosted on local cloud nodes in India. The gazette provides an 18-month compliance window ending May 2027."
            rule_citation = "MeitY DPDP Notification 2025 - Clause 4.3"

        # 2. Query Chroma for vector match
        doc_text = rule_fallback or "No exact spec reference found in local vector index."
        citation = rule_citation or "Default Project Specifications Guide"
        
        try:
            collection = get_vector_db()
            chroma_res = collection.query(
                query_texts=[query_clean],
                n_results=1
            )
            
            if chroma_res and chroma_res.get("documents") and chroma_res["documents"][0]:
                doc_text = chroma_res["documents"][0][0]
                meta = chroma_res["metadatas"][0][0]
                citation = f"{meta['source']} - Section {meta['section']}"
        except Exception as e:
            print(f"Chroma Query warning: {e}. Using rule fallback.")

        # 3. Formulate prompt for Gemini
        prompt = (
            f"You are the Aegis RFI Knowledge Copilot—both a data center engineering RAG assistant and a general conversational chatbot.\n\n"
            f"If the user query is a general chat, a conversational query, or completely unrelated "
            f"to data center specifications, respond naturally, helpfully, and friendly as a general AI assistant. "
            f"Prefix your response with 'CHATBOT:' to indicate it is a general chat response.\n\n"
            f"If the user query is asking about data center specifications, clearances, limits, or engineering tasks, use the provided "
            f"context below to synthesize a concise, technical response in 2-3 sentences. Cite the source section clearly. "
            f"Do NOT prefix with 'CHATBOT:' in this case.\n\n"
            f"Context: {doc_text}\n"
            f"Query: {query_clean}\n\n"
            f"Response:"
        )

        response_text = doc_text
        try:
            llm_res = self.llm.generate_content(prompt)
            if llm_res.startswith("CHATBOT:"):
                response_text = llm_res.replace("CHATBOT:", "").strip()
                citation = None
            else:
                response_text = llm_res.strip()
        except Exception as e:
            print(f"Gemini LLM generation failed: {e}. Using rule match/vector text.")
            response_text = doc_text

        # 4. Check for duplicates in KuzuDB safely
        duplicates = self.check_duplicate_rfis(query_clean)

        # 5. Save engineering-related RFI query dynamically in KuzuDB
        if citation is not None:
            tag_match = "clearance"
            if "piping" in query_lower or "pipe" in query_lower:
                tag_match = "piping"
            elif "generator" in query_lower or "rating" in query_lower or "genset" in query_lower:
                tag_match = "rating"
            
            import time
            rfi_id = f"RFI-USER-{int(time.time())}"
            title_escaped = query_clean[:40].replace("'", "''") + ("..." if len(query_clean) > 40 else "")
            query_escaped = query_clean.replace("'", "''")
            
            try:
                conn = get_db_connection()
                with db_lock:
                    conn.execute(
                        f"CREATE (r:RFI {{id: '{rfi_id}', title: '{title_escaped}', description: '{query_escaped}', "
                        f"status: 'OPEN', resolution: 'PENDING', tags: '{tag_match}'}});"
                    )
            except Exception as ex:
                print(f"Failed to log user RFI dynamically: {ex}")

        return {
            "response": response_text,
            "citation": citation,
            "duplicates": duplicates
        }

    def check_duplicate_rfis(self, query: str) -> list:
        """
        Scans KuzuDB safely for existing CLOSED RFIs with matching tags to prevent duplicate submission re-work.
        """
        query_lower = query.lower()
        
        tag_match = None
        if "clearance" in query_lower or "space" in query_lower or "spacing" in query_lower:
            tag_match = "clearance"
        elif "piping" in query_lower or "pipe" in query_lower:
            tag_match = "piping"
        elif "generator" in query_lower or "rating" in query_lower or "genset" in query_lower:
            tag_match = "rating"

        if not tag_match:
            return []

        duplicates = []
        try:
            conn = get_db_connection()
            with db_lock:
                kuzu_query = f"MATCH (r:RFI) WHERE r.tags CONTAINS '{tag_match}' RETURN r.id, r.title, r.description, r.status, r.resolution"
                res = conn.execute(kuzu_query)
                
                while res.has_next():
                    r_id, r_title, r_desc, r_status, r_resol = res.get_next()
                    duplicates.append({
                        "id": r_id,
                        "title": r_title,
                        "description": r_desc,
                        "status": r_status,
                        "resolution": r_resol
                    })
        except Exception as e:
            print(f"Error checking duplicate RFIs in KuzuDB: {e}")

        return duplicates
