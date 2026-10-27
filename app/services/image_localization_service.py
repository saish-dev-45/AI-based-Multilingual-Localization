import logging
import os
import re
import sys
from pathlib import Path

# Ensure project root is in sys.path when run directly
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2

from app.services.ocr_services import ocr_service
from app.services.image_cleanup_service import remove_text
from app.services.image_render_service import (
    extract_text_color,
    render_localized_image,
)
from app.agents.orchestrator import run_localization
from app.services.llm_client import llm

logger = logging.getLogger(__name__)


def localize_image(
    image_path: str,
    target_language: str = "Hindi",
    tone: str = "natural",
    font_path: str | None = None,
    output_path: str = "localized_image.png",
) -> dict:
    # 1. Extract text and bounding boxes.
    regions = ocr_service.extract_from_image(image_path)

    if not regions:
        raise ValueError("No text was detected in the image.")

    # Load original image to sample text colors
    original_image = cv2.imread(image_path)
    if original_image is None:
        raise ValueError(f"Could not read image: {image_path}")

    # 2. Localize each detected text region and detect its color.
    localized_regions = []

    for region in regions:
        text_to_translate = (region.get("text") or "").strip()
        if not text_to_translate:
            continue

        # If text is solely numbers, timestamps, or symbols (e.g. "12:30", "100%", "$50"), preserve as-is
        if re.match(r"^[\d\s\W]+$", text_to_translate):
            color = extract_text_color(original_image, region["bbox"])
            localized_regions.append({
                "bbox": region["bbox"],
                "source_text": text_to_translate,
                "localized_text": text_to_translate,
                "confidence": region.get("confidence", 1.0),
                "color": color,
            })
            continue

        localized_str = ""
        try:
            result = run_localization(
                source_text=text_to_translate,
                target_language=target_language,
                tone=tone,
                use_rag=False,  # Skip heavy RAG vector query for short image labels
            )
            localized_str = result.get("localized_text") or result.get("machine_translation") or ""
        except Exception as loc_err:
            logger.warning("run_localization error on '%s': %s", text_to_translate, loc_err)

        # Graceful fallback: If localization failed or quality review rejected, use fast direct LLM translation
        if not localized_str:
            try:
                prompt = (
                    f"Translate the following short phrase into natural spoken {target_language}. "
                    f"Return ONLY the translation without any notes or English:\n{text_to_translate}"
                )
                res = llm.invoke(prompt)
                content = res.content
                if isinstance(content, list):
                    content = "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
                content = re.sub(r"<think>.*?</think>", "", str(content), flags=re.DOTALL).strip()
                localized_str = re.sub(r"[*#_`~>\[\]]", "", content).strip()
            except Exception as llm_err:
                logger.warning("Fallback LLM translation failed for '%s': %s", text_to_translate, llm_err)
                localized_str = text_to_translate

        # Sample original text color from bounding box
        color = extract_text_color(original_image, region["bbox"])

        localized_regions.append({
            "bbox": region["bbox"],
            "source_text": text_to_translate,
            "localized_text": localized_str,
            "confidence": region.get("confidence", 1.0),
            "color": color,
        })

    # 3. Remove the original text.
    cleaned_image = remove_text(image_path, regions)

    # 4. Render localized text with adaptive colors.
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    rendered_path = render_localized_image(
        cleaned_image=cleaned_image,
        localized_regions=localized_regions,
        font_path=font_path or resolve_devanagari_font(),
        output_path=output_path,
        original_image=original_image,
    )

    extracted_lines = [r["source_text"] for r in localized_regions if r.get("source_text")]
    localized_lines = [r["localized_text"] for r in localized_regions if r.get("localized_text")]

    return {
        "output_path": rendered_path,
        "extracted_text": "\n".join(extracted_lines),
        "localized_text": "\n".join(localized_lines),
        "regions": [
            {
                "source_text": r["source_text"],
                "localized_text": r["localized_text"],
                "bbox": r["bbox"],
                "confidence": r.get("confidence", 1.0),
            }
            for r in localized_regions
        ],
    }


def resolve_devanagari_font() -> str:
    """Find a Devanagari-capable font in the project or host OS."""
    configured_font = os.getenv("LOCALIZATION_FONT_PATH")
    candidates = ([Path(configured_font)] if configured_font else []) + [
        Path(__file__).resolve().parents[2] / "fonts" / "NotoSansDevanagari-Regular.ttf",
        Path("C:/Windows/Fonts/Nirmala.ttc"),
        Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoSansDevanagariUI-Regular.ttf"),
        Path("/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise ValueError(
        "No Devanagari font was found. Set LOCALIZATION_FONT_PATH or "
        "install Noto Sans Devanagari/Nirmala UI."
    )
