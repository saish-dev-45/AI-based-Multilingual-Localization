"""Speech-to-Text service for transcribing voice audio into text."""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from groq import Groq

from app.config import BASE_DIR, GROQ_API_KEY

logger = logging.getLogger(__name__)

# Max upload size: 25 MB (standard Whisper limit)
MAX_AUDIO_BYTES = 25 * 1024 * 1024

_groq_client: Optional[Groq] = None


def get_groq_client() -> Groq:
    """Lazily initialize the Groq client for Whisper STT."""
    global _groq_client
    if _groq_client is not None:
        return _groq_client

    api_key = GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is missing from the environment.")

    _groq_client = Groq(api_key=api_key)
    return _groq_client


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: Optional[str] = None,
    prompt: Optional[str] = None,
) -> str:
    """Transcribe speech audio into text using Groq Whisper.

    Args:
        audio_bytes: Raw binary audio data (.webm, .wav, .mp3, .m4a, .ogg).
        filename: Name of the audio file with extension for format deduction.
        language: Optional ISO-639-1 language code (e.g., 'en', 'hi', 'mr').
                  If None, Whisper auto-detects the spoken language.
        prompt: Optional context prompt to guide spelling or technical terms.

    Returns:
        Transcribed plain text string.
    """
    if not audio_bytes:
        raise ValueError("Audio recording is empty.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError(
            f"Audio file exceeds the {MAX_AUDIO_BYTES // (1024 * 1024)} MB limit."
        )

    # Ensure a valid file extension is provided so Whisper knows the codec
    suffix = Path(filename or "audio.webm").suffix.lower()
    if not suffix or suffix not in {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".flac"}:
        filename = "audio.webm"

    client = get_groq_client()

    kwargs = {
        "file": (filename, audio_bytes),
        "model": "whisper-large-v3-turbo",
        "response_format": "verbose_json",
        "temperature": 0.0,
    }

    if language and language.strip():
        kwargs["language"] = language.strip().lower()

    if prompt and prompt.strip():
        kwargs["prompt"] = prompt.strip()

    try:
        transcription = client.audio.transcriptions.create(**kwargs)
        text = (getattr(transcription, "text", "") or "").strip()
        detected_lang = getattr(transcription, "language", "") or ""
        duration = getattr(transcription, "duration", 0.0) or 0.0
        return {
            "text": text,
            "detected_language": detected_lang.capitalize() if detected_lang else "Detected",
            "duration": round(float(duration), 2),
        }
    except Exception as exc:
        err_msg = str(exc)
        if "audio_too_short" in err_msg or "too short" in err_msg.lower():
            raise ValueError(
                "Audio recording is too short (minimum duration is 0.01 seconds). Please speak and try again."
            ) from exc
        if (
            "invalid_media_file" in err_msg
            or "could not process file" in err_msg.lower()
            or "could not be decoded" in err_msg.lower()
            or "unsupported" in err_msg.lower()
        ):
            raise ValueError(
                "Audio file format was not accepted by the speech engine. Please record again or upload a standard audio file (.wav, .mp3, .m4a)."
            ) from exc
        logger.exception("Groq Whisper transcription failed")
        raise RuntimeError(f"Speech transcription failed: {exc}") from exc
