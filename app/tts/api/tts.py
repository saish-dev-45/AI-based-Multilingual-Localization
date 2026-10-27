import base64
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.tts.tts_service import generate_speech
from app.services.llm_client import llm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["Text-to-Speech"])


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500, description="Text to synthesize")
    language: str = Field(min_length=2, max_length=50, description="Language name or code (hi, mr, Hindi, Marathi, etc.)")
    speaker: Optional[str] = Field(default="shubh", description="Voice speaker name")


class ContextualSpeechRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2500, description="Input text, question, or scenario")
    context_purpose: str = Field(default="Customer Support", description="Context/purpose (e.g. customer support, education, e-commerce, story, announcements)")
    tone: str = Field(default="Friendly and professional", description="Tone of voice")
    target_language: str = Field(default="Hindi", description="Target language (Hindi, Marathi, English, etc.)")
    speaker: Optional[str] = Field(default="shubh", description="Voice speaker name (shubh, priya, rohan, neha, aditya, simran)")
    mode: str = Field(default="answer_and_speak", description="Operation mode: 'answer_and_speak', 'adapt_and_speak', or 'direct_speak'")
    auto_localize: Optional[bool] = Field(default=True, description="Whether to automatically localize text into target_language in direct_speak mode")


class ContextualSpeechResponse(BaseModel):
    query: str
    context_purpose: str
    tone: str
    target_language: str
    speaker: str
    mode: str
    generated_text: str
    audio_base64: str
    original_text: Optional[str] = None
    was_localized: Optional[bool] = False


def is_already_target_language(text: str, target_lang: str) -> bool:
    """Check if the text is already written in the target language script."""
    norm_lang = target_lang.lower().strip()
    has_latin = bool(re.search(r'[A-Za-z]', text))
    has_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
    has_gujarati = bool(re.search(r'[\u0A80-\u0AFF]', text))
    has_bengali = bool(re.search(r'[\u0980-\u09FF]', text))
    has_tamil = bool(re.search(r'[\u0B80-\u0BFF]', text))
    has_telugu = bool(re.search(r'[\u0C00-\u0C7F]', text))
    has_kannada = bool(re.search(r'[\u0C80-\u0CFF]', text))
    has_malayalam = bool(re.search(r'[\u0D00-\u0D7F]', text))
    has_punjabi = bool(re.search(r'[\u0A00-\u0A7F]', text))

    if norm_lang in ("hi", "hindi", "mr", "marathi"):
        dev_count = len(re.findall(r'[\u0900-\u097F]', text))
        latin_count = len(re.findall(r'[A-Za-z]', text))
        return dev_count > 0 and dev_count >= latin_count
    elif norm_lang in ("en", "english"):
        return has_latin and not has_devanagari
    elif norm_lang in ("gu", "gujarati"):
        return has_gujarati
    elif norm_lang in ("bn", "bengali"):
        return has_bengali
    elif norm_lang in ("ta", "tamil"):
        return has_tamil
    elif norm_lang in ("te", "telugu"):
        return has_telugu
    elif norm_lang in ("kn", "kannada"):
        return has_kannada
    elif norm_lang in ("ml", "malayalam"):
        return has_malayalam
    elif norm_lang in ("pa", "punjabi"):
        return has_punjabi
    return False


def compose_contextual_speech_script(
    query: str,
    context_purpose: str,
    tone: str,
    target_language: str,
    mode: str = "answer_and_speak",
    auto_localize: bool = True,
) -> tuple[str, bool]:
    """Generate or adapt text using Groq LLM based on user context, purpose, and tone.
    
    Returns:
        tuple[str, bool]: (final_script_text, was_localized_flag)
    """
    clean_query = query.strip()
    if mode == "direct_speak":
        if not auto_localize:
            return clean_query, False

        # If already in the target language script, no localization needed
        if is_already_target_language(clean_query, target_language):
            return clean_query, False

        # Otherwise, translate and localize into target_language for speech delivery
        system_prompt = f"""You are an expert multilingual voice localization assistant.
Translate and culturally localize the following text into natural, fluent spoken {target_language}.

SOURCE TEXT:
{clean_query}

TARGET LANGUAGE: {target_language}

Instructions:
1. Translate and culturally localize the text into natural, spoken {target_language}.
2. Use phrasing that sounds completely natural when spoken aloud by a Text-to-Speech voice engine.
3. If technical terms or brand names should be kept in common spoken form, do so naturally.
4. Do NOT use markdown symbols (no asterisks, bolding, hashes, bullets, quotes, or brackets).
5. Do NOT include emojis or unpronounceable characters.
6. Keep the translation faithful to the meaning without omitting facts.
7. Return ONLY the spoken text in {target_language}. Do not include any introductory notes or English translations.
"""
    elif mode == "adapt_and_speak":
        system_prompt = f"""You are a voice localization expert.
The user wants to adapt the following source text for spoken audio delivery.

SOURCE TEXT:
{clean_query}

TARGET LANGUAGE: {target_language}
CONTEXT / PURPOSE: {context_purpose}
TONE OF VOICE: {tone}

Instructions:
1. Localize and rewrite the text into natural {target_language} tailored specifically for the context/purpose and tone.
2. The result will be read aloud by a Text-to-Speech voice engine.
3. Use natural spoken phrasing with natural pauses.
4. Do NOT use markdown symbols (no asterisks, bolding, hashes, bullets, quotes, or brackets).
5. Do NOT include emojis or unpronounceable characters.
6. Keep it concise (under 1200 characters).
7. Return ONLY the spoken text in {target_language}. Do not include introductory notes or English translations.
"""
    else:  # "answer_and_speak"
        system_prompt = f"""You are an intelligent multilingual voice assistant.
The user asked the following question or provided this prompt:
"{clean_query}"

TARGET LANGUAGE: {target_language}
CONTEXT / PURPOSE: {context_purpose}
TONE OF VOICE: {tone}

Instructions:
1. Provide a direct, helpful, and natural spoken answer in {target_language}.
2. Tailor the content and vocabulary to match the specified context/purpose: "{context_purpose}".
3. Match the requested tone of voice: "{tone}".
4. The response will be synthesized into spoken audio. Write naturally for oral speech.
5. Do NOT use markdown symbols (no asterisks, bolding, hashes, bullets, quotes, or brackets).
6. Do NOT include emojis or unpronounceable characters.
7. Keep the answer concise and engaging (1 to 4 sentences, under 1000 characters).
8. Return ONLY the spoken answer in {target_language}. Do not include introductions like 'Here is your answer' or English explanations.
"""

    response = llm.invoke(system_prompt)
    content = response.content

    if isinstance(content, list):
        text = "".join(
            block.get("text", "") if isinstance(block, dict) and block.get("type") == "text"
            else block if isinstance(block, str) else ""
            for block in content
        )
    else:
        text = str(content)

    # Strip thinking blocks if present
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Clean markdown formatting that sounds weird or breaks TTS
    text = re.sub(r"[*#_`~>\[\]]", "", text).strip()
    # Normalize multiple newlines
    text = re.sub(r"\n+", " ", text).strip()

    if not text:
        raise ValueError("AI failed to generate a response script.")

    return text, True


@router.post("/generate")
def generate_tts(request: TTSRequest):
    try:
        audio_bytes = generate_speech(
            text=request.text,
            language=request.language,
            speaker=request.speaker or "shubh",
        )

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'inline; filename="speech.wav"',
                "Accept-Ranges": "bytes",
            },
        )

    except ValueError as exc:
        err_msg = str(exc)
        if "SARVAM_API_KEY" in err_msg:
            logger.error("TTS configuration error: %s", err_msg)
            raise HTTPException(status_code=503, detail="TTS service is unconfigured. SARVAM_API_KEY is missing.") from exc
        raise HTTPException(status_code=400, detail=err_msg) from exc

    except Exception as exc:
        logger.exception("TTS generation failed")
        raise HTTPException(
            status_code=502,
            detail=f"Speech generation failed: {exc}",
        ) from exc


@router.post("/context-speech", response_model=ContextualSpeechResponse)
def generate_contextual_speech(request: ContextualSpeechRequest):
    try:
        # Step 1: Compose or adapt text based on purpose, context, tone, and auto-localization
        script, was_localized = compose_contextual_speech_script(
            query=request.query,
            context_purpose=request.context_purpose,
            tone=request.tone,
            target_language=request.target_language,
            mode=request.mode,
            auto_localize=request.auto_localize if request.auto_localize is not None else True,
        )

        # Step 2: Synthesize speech via Sarvam AI
        audio_bytes = generate_speech(
            text=script,
            language=request.target_language,
            speaker=request.speaker or "shubh",
        )

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        return ContextualSpeechResponse(
            query=request.query,
            context_purpose=request.context_purpose,
            tone=request.tone,
            target_language=request.target_language,
            speaker=request.speaker or "shubh",
            mode=request.mode,
            generated_text=script,
            audio_base64=audio_b64,
            original_text=request.query,
            was_localized=was_localized,
        )

    except ValueError as exc:
        err_msg = str(exc)
        if "SARVAM_API_KEY" in err_msg:
            logger.error("TTS configuration error: %s", err_msg)
            raise HTTPException(status_code=503, detail="TTS service is unconfigured. SARVAM_API_KEY is missing.") from exc
        if "GROQ_API_KEY" in err_msg:
            logger.error("LLM configuration error: %s", err_msg)
            raise HTTPException(status_code=503, detail="LLM service is unconfigured. GROQ_API_KEY is missing.") from exc
        raise HTTPException(status_code=400, detail=err_msg) from exc

    except Exception as exc:
        logger.exception("Contextual speech generation failed")
        raise HTTPException(
            status_code=502,
            detail=f"Contextual speech generation failed: {exc}",
        ) from exc
