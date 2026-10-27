import base64
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sarvamai import SarvamAI

# Load .env safely from project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

LANGUAGE_CODES = {
    "hi": "hi-IN",
    "hindi": "hi-IN",
    "hi-in": "hi-IN",
    "mr": "mr-IN",
    "marathi": "mr-IN",
    "mr-in": "mr-IN",
    "en": "en-IN",
    "english": "en-IN",
    "en-in": "en-IN",
    "gu": "gu-IN",
    "gujarati": "gu-IN",
    "gu-in": "gu-IN",
    "bn": "bn-IN",
    "bengali": "bn-IN",
    "bn-in": "bn-IN",
    "ta": "ta-IN",
    "tamil": "ta-IN",
    "ta-in": "ta-IN",
    "te": "te-IN",
    "telugu": "te-IN",
    "te-in": "te-IN",
    "kn": "kn-IN",
    "kannada": "kn-IN",
    "kn-in": "kn-IN",
    "ml": "ml-IN",
    "malayalam": "ml-IN",
    "ml-in": "ml-IN",
    "pa": "pa-IN",
    "punjabi": "pa-IN",
    "pa-in": "pa-IN",
}

_client: Optional[SarvamAI] = None


def get_client() -> SarvamAI:
    """Lazily initialize and return the SarvamAI client."""
    global _client
    if _client is not None:
        return _client

    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise ValueError("SARVAM_API_KEY is missing from the environment")

    _client = SarvamAI(api_subscription_key=api_key)
    return _client


def generate_speech(text: str, language: str, speaker: str = "shubh") -> bytes:
    normalized_lang = (language or "").strip().lower()
    if normalized_lang not in LANGUAGE_CODES:
        supported = ", ".join(["Hindi (hi)", "Marathi (mr)", "English (en)", "Gujarati (gu)", "Bengali (bn)", "Tamil (ta)", "Telugu (te)", "Kannada (kn)", "Malayalam (ml)", "Punjabi (pa)"])
        raise ValueError(f"Unsupported language '{language}'. Supported: {supported}")


    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    if len(text) > 2500:
        raise ValueError("Text must be 2500 characters or fewer")

    client = get_client()

    response = client.text_to_speech.convert(
        text=text,
        language_code=LANGUAGE_CODES[normalized_lang],
        model="bulbul:v3",
        speaker=speaker,
    )

    if not response.audios:
        raise RuntimeError("Sarvam returned no audio")

    return base64.b64decode("".join(response.audios))