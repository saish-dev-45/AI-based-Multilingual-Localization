
import base64
import json
import logging
import os
import re
import shutil
import sys
import tempfile
from io import BytesIO
from pathlib import Path

# Ensure UTF-8 output on Windows consoles to prevent charmap UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from app.schemas import (
    ContextSuggestionRequest,
    ContextSuggestionResponse,
    LocalizationRequest,
    LocalizationResponse,
)
from app.agents.orchestrator import run_localization
from app.config import LANGUAGE_CONFIG
from app.services.document_service import (
    delete_document,
    extract_upload_text,
    list_documents,
    save_and_index,
)
from app.services.image_localization_service import (
    localize_image as localize_image_service,
)
from app.services.locale_formatting import LocaleFormattingDependencyError
from app.services.llm_client import llm
from app.services.stt_service import transcribe_audio
from app.tts.api.tts import router as tts_router

logger = logging.getLogger(__name__)
MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000

app = FastAPI(
    title="AI-Powered Multilingual Localization API",
    description=(
        "Translate, localize, validate, and review text "
        "using multilingual AI agents."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tts_router)



@app.get("/")
def home():
    return {
        "message": "Multilingual Localization API is running.",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post(
    "/localize",
    response_model=LocalizationResponse,
)
def localize_text(request: LocalizationRequest):
    try:
        target_language = request.target_language
        if request.target_locale:
            locale_languages = {
                config["locale"]: language
                for language, config in LANGUAGE_CONFIG.items()
            }
            target_language = locale_languages.get(request.target_locale)
            if target_language is None:
                supported = ", ".join(locale_languages)
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported target locale. Supported: {supported}",
                )

        result = run_localization(
            source_text=request.source_text,
            target_language=target_language,
            target_locale=request.target_locale,
            tone=request.tone,
            domain=request.domain,
            target_audience=request.target_audience,
            formality=request.formality,
            vocabulary_style=request.vocabulary_style,
            additional_instructions=request.additional_instructions,
            use_rag=request.use_rag,
        )

        analysis = result.get("analysis", {})

        response = {
            "source_text": result["source_text"],
            "target_language": result["target_language"],
            "target_locale": analysis.get("target_locale", "") or result.get("target_locale", ""),
            "tone": result.get("tone", request.tone),
            "context_brief": {
                "domain": request.domain,
                "target_audience": request.target_audience,
                "formality": request.formality,
                "vocabulary_style": request.vocabulary_style,
                "additional_instructions": request.additional_instructions,
            },
            "machine_translation": result["machine_translation"],
            "localized_text": result["localized_text"],
            "quality_review": result["quality_review"],
            "references": result.get("references", []),
            "retry_count": result["retry_count"],
            "status": result["status"],
            "error": result["error"],
        }

        if result["status"] != "completed":
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Localization workflow failed.",
                    "error": result["error"],
                    "result": response,
                },
            )

        return response

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except LocaleFormattingDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred during localization.",
        ) from exc


@app.post("/localize/suggest-context", response_model=ContextSuggestionResponse)
def suggest_localization_context(request: ContextSuggestionRequest):
    """Analyze source text and suggest the optimal cultural localization persona."""
    try:
        prompt = f"""You are a cultural localization architect for Indian regional languages.
Analyze the following English text and choose the optimal localization persona for translating into {request.target_language}:

SOURCE TEXT:
\"\"\"{request.source_text}\"\"\"

Select the most suitable category for each:
1. DOMAIN: Exactly one of: ["App UI", "E-Commerce", "FinTech & Banking", "Healthcare", "Customer Support", "Marketing & Ads", "Legal & Compliance", "General"]
2. AUDIENCE: Exactly one of: ["General Public", "Youth & Tech-Savvy", "Corporate & B2B", "Elders & Traditional"]
3. FORMALITY: Exactly one of: ["Formal & Respectful", "Warm & Conversational", "Casual & Direct"]
4. VOCABULARY: Exactly one of: ["Modern Contemporary", "Pure Vernacular Classical", "Tech Terms Preserved"]
5. TONE: Exactly one of: ["friendly and professional", "urgent and persuasive", "reassuring and empathetic", "concise and direct", "authoritative and serious"]
6. RATIONALE: One concise sentence explaining why this profile is ideal.

Return ONLY a valid JSON object matching this structure:
{{
  "domain": "...",
  "target_audience": "...",
  "formality": "...",
  "vocabulary_style": "...",
  "tone": "...",
  "rationale": "..."
}}
Do NOT output markdown ticks or explanation outside JSON."""

        response = llm.invoke(prompt)
        content = response.content
        if isinstance(content, list):
            content = "".join(
                b.get("text", "") if isinstance(b, dict) and b.get("type") == "text" else str(b)
                for b in content
            )
        text_resp = re.sub(r"<think>.*?</think>", "", str(content), flags=re.DOTALL).strip()
        text_resp = re.sub(r"^```(?:json)?|```$", "", text_resp, flags=re.MULTILINE).strip()
        data = json.loads(text_resp)

        return ContextSuggestionResponse(
            domain=data.get("domain", "General"),
            target_audience=data.get("target_audience", "General Public"),
            formality=data.get("formality", "Formal & Respectful"),
            vocabulary_style=data.get("vocabulary_style", "Modern Contemporary"),
            tone=data.get("tone", "friendly and professional"),
            rationale=data.get("rationale", "Selected based on source text phrasing and intent."),
        )
    except Exception as exc:
        logger.warning("Context suggestion failed, returning default profile: %s", exc)
        return ContextSuggestionResponse(
            domain="General",
            target_audience="General Public",
            formality="Formal & Respectful",
            vocabulary_style="Modern Contemporary",
            tone="friendly and professional",
            rationale="Default balanced persona for general audiences.",
        )


@app.get("/documents")
def get_documents():
    return {"documents": list_documents()}


@app.post("/documents")
async def upload_documents(files: list[UploadFile] = File(...)):
    """Upload one or more documents and index them for RAG."""
    uploaded, failed = [], []

    for file in files:
        try:
            content = await file.read()
            uploaded.append(save_and_index(file.filename, content))
        except Exception as exc:
            logger.warning("Upload failed for %s: %s", file.filename, exc)
            failed.append({
                "name": file.filename,
                "error": str(exc),
            })

    if not uploaded and failed:
        raise HTTPException(
            status_code=400,
            detail="; ".join(
                f"{f['name']}: {f['error']}" for f in failed
            ),
        )

    return {"uploaded": uploaded, "failed": failed}


@app.post("/documents/extract")
async def extract_document_text(file: UploadFile = File(...)):
    """Read a document to localize; its text is returned, not indexed."""
    try:
        content = await file.read()
        text = extract_upload_text(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("Extraction failed for %s: %s", file.filename, exc)
        raise HTTPException(
            status_code=400,
            detail=f"Could not read '{file.filename}': {exc}",
        ) from exc

    return {"filename": file.filename, "text": text}


@app.delete("/documents/{filename}")
def remove_document(filename: str):
    if not delete_document(filename):
        raise HTTPException(status_code=404, detail="Document not found.")

    return {"deleted": filename}


@app.post("/images/localize")
async def localize_image_endpoint(
    file: UploadFile = File(...),
    target_language: str = Form("Hindi"),
    tone: str = Form("natural", max_length=100),
):
    """OCR an image, localize each detected text region, and return a PNG."""
    if target_language not in LANGUAGE_CONFIG:
        supported = ", ".join(LANGUAGE_CONFIG)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language. Supported: {supported}",
        )

    suffix = Path(file.filename or "upload.png").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Use PNG, JPG, JPEG, or WEBP.",
        )

    temp_dir = None
    output_path = None
    try:
        content = await file.read(MAX_IMAGE_UPLOAD_BYTES + 1)
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded image is empty.")
        if len(content) > MAX_IMAGE_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit.")

        try:
            with Image.open(BytesIO(content)) as image:
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(
                        status_code=413,
                        detail="Image dimensions exceed the 25 megapixel limit.",
                    )
                image.verify()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid image.",
            ) from exc

        temp_dir = tempfile.mkdtemp(prefix="localization-image-")
        input_path = Path(temp_dir) / f"source{suffix}"
        output_path = Path(temp_dir) / "localized.png"
        input_path.write_bytes(content)

        localization_res = await run_in_threadpool(
            localize_image_service,
            str(input_path),
            target_language,
            tone,
            os.getenv("LOCALIZATION_FONT_PATH"),
            str(output_path),
        )

        out_path = Path(localization_res["output_path"]) if isinstance(localization_res, dict) else Path(output_path)
        out_bytes = out_path.read_bytes()
        image_b64 = f"data:image/png;base64,{base64.b64encode(out_bytes).decode('utf-8')}"

        extracted_text = localization_res.get("extracted_text", "") if isinstance(localization_res, dict) else ""
        localized_text = localization_res.get("localized_text", "") if isinstance(localization_res, dict) else ""
        regions_data = localization_res.get("regions", []) if isinstance(localization_res, dict) else []

        # Cleanup temporary files
        shutil.rmtree(temp_dir, ignore_errors=True)

        return {
            "image_url": image_b64,
            "extracted_text": extracted_text,
            "localized_text": localized_text,
            "target_language": target_language,
            "regions": regions_data,
        }
    except HTTPException:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except ValueError as exc:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        logger.exception("Image localization failed")
        raise HTTPException(
            status_code=500,
            detail=f"Image localization failed: {exc}",
        ) from exc
    finally:
        await file.close()


@app.post("/stt/transcribe")
async def transcribe_speech(
    file: UploadFile = File(...),
    language: str | None = Form(None),
    target_language: str | None = Form(None),
    tone: str | None = Form("natural"),
):
    """Transcribe speech audio into text using Groq Whisper, with auto-detected language and optional target language translation."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded audio is empty.")
        stt_result = transcribe_audio(
            content,
            filename=file.filename or "speech.wav",
            language=language,
        )

        text = stt_result.get("text", "") if isinstance(stt_result, dict) else str(stt_result)
        detected_language = stt_result.get("detected_language", "Auto-detected") if isinstance(stt_result, dict) else "Auto-detected"
        duration = stt_result.get("duration", 0.0) if isinstance(stt_result, dict) else 0.0

        localized_text = ""
        # If user asked for an output language, localize the transcribed text
        if target_language and target_language.strip() and text:
            clean_target = target_language.strip()
            if clean_target.lower() in {"hi", "hindi"}:
                clean_target = "Hindi"
            elif clean_target.lower() in {"mr", "marathi"}:
                clean_target = "Marathi"
            elif clean_target.lower() in {"en", "english"}:
                clean_target = "English"

            try:
                loc_res = run_localization(
                    source_text=text,
                    target_language=clean_target,
                    tone=tone or "natural",
                    use_rag=False,
                )
                if loc_res.get("status") == "completed":
                    localized_text = loc_res.get("localized_text", "")
            except Exception as loc_err:
                logger.warning("Optional localization in STT failed: %s", loc_err)

        return {
            "text": text,
            "detected_language": detected_language,
            "target_language": target_language or "",
            "localized_text": localized_text,
            "duration": duration,
            "filename": file.filename or "speech.wav",
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Speech transcription failed")
        raise HTTPException(
            status_code=500,
            detail=f"Speech transcription failed: {exc}",
        ) from exc
    finally:
        await file.close()

