import os
import json
from threading import RLock
import numpy as np
from PIL import Image

# EasyOCR is used instead of PaddleOCR.
# PaddleOCR (via PaddleX) raises NotImplementedError on Windows when its
# oneDNN/PIR backend tries to convert DoubleAttribute instructions at runtime.
# EasyOCR uses PyTorch and works correctly on all platforms.
import easyocr


class OCRService:
    """Extract text and bounding boxes from images and scanned PDFs."""

    def __init__(self, languages=None):
        # Default to English; add 'hi' for Hindi if needed for bilingual images.
        self.languages = languages or ["en"]
        self._reader = None
        self._lock = RLock()

    @property
    def reader(self):
        """Load EasyOCR reader only on first use (model is ~200 MB)."""
        with self._lock:
            if self._reader is None:
                self._reader = easyocr.Reader(
                    self.languages,
                    gpu=False,
                    verbose=False,
                )
        return self._reader

    def extract_from_image(self, image_path: str) -> list[dict]:
        if not os.path.isfile(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        results = self.reader.readtext(image_path, detail=1)

        extracted = []
        for (bbox_points, text, confidence) in results:
            text = text.strip()
            if not text or confidence < 0.3:
                continue

            # bbox_points is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
            # Convert to flat [x1, y1, x2, y2]
            xs = [pt[0] for pt in bbox_points]
            ys = [pt[1] for pt in bbox_points]
            bbox = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

            extracted.append({
                "text": text,
                "bbox": bbox,
                "confidence": round(confidence, 3),
            })

        return extracted

    def extract_from_pdf(self, pdf_path: str) -> list[dict]:
        """Extract text regions from a PDF using PyMuPDF + EasyOCR."""
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise RuntimeError(
                "PDF OCR requires a working PyMuPDF installation."
            ) from exc

        if not os.path.isfile(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        extracted = []

        with fitz.open(pdf_path) as pdf:
            for page_number, page in enumerate(pdf):
                page_text = page.get_text().strip()

                if page_text:
                    for block in page.get_text("blocks"):
                        text = block[4].strip()
                        if text:
                            extracted.append({
                                "text": text,
                                "bbox": [int(v) for v in block[:4]],
                                "page": page_number,
                            })
                else:
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    image = Image.frombytes(
                        "RGB", [pix.width, pix.height], pix.samples
                    )
                    results = self.reader.readtext(np.array(image), detail=1)

                    for (bbox_points, text, confidence) in results:
                        text = text.strip()
                        if not text or confidence < 0.3:
                            continue

                        xs = [pt[0] for pt in bbox_points]
                        ys = [pt[1] for pt in bbox_points]
                        bbox = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

                        extracted.append({
                            "text": text,
                            "bbox": bbox,
                            "confidence": round(confidence, 3),
                            "page": page_number,
                        })

        return extracted


ocr_service = OCRService(languages=["en"])
