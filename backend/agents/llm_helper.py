import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_client = None
from google import genai
from google.genai import types
if GEMINI_API_KEY:
    try:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Gemini Client: {e}")


class GeminiLLMHelper:
    """
    Orchestrates Google Gemini API calls with fast model fallback.
    """
    def __init__(self):
        self.client = _client
        # API models configured for user's Gemini key
        self.models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]

    def generate_content(self, prompt: str) -> str:
        """
        Sends text prompt to Gemini with fast model fallback.
        """
        if not self.client:
            raise ValueError("Gemini Client not initialized. Check GEMINI_API_KEY in .env.")
        
        last_err = None
        for m in self.models:
            try:
                response = self.client.models.generate_content(
                    model=m,
                    contents=prompt
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                print(f"Gemini model {m} call error: {e}")
                last_err = e
        raise last_err or RuntimeError("All Gemini models failed to respond.")

    def generate_vision_content(self, prompt: str, image_bytes: bytes, mime_type: str) -> str:
        """
        Sends vision prompt and image payload to Gemini with model fallback.
        """
        if not self.client:
            raise ValueError("Gemini Client not initialized. Check GEMINI_API_KEY in .env.")
        
        last_err = None
        for m in self.models:
            try:
                response = self.client.models.generate_content(
                    model=m,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt
                    ]
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                print(f"Gemini vision model {m} call error: {e}")
                last_err = e
        raise last_err or RuntimeError("All Gemini vision models failed to respond.")
