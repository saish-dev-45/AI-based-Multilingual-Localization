import threading

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from app.config import (
    TRANSLATION_MODEL_NAME,
    SOURCE_LANGUAGE_CODE,
    LANGUAGE_CONFIG,
)


class TranslationService:
    """Translate English text using the NLLB multilingual model."""

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = None
        self.model = None
        self._load_lock = threading.Lock()

    def _ensure_model_loaded(self) -> None:
        """Load the large translation model only when translation is requested."""
        if self.model is not None and self.tokenizer is not None:
            return
        with self._load_lock:
            if self.model is not None and self.tokenizer is not None:
                return
            print(f"Loading translation model on {self.device}...")
            tokenizer = AutoTokenizer.from_pretrained(TRANSLATION_MODEL_NAME)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                TRANSLATION_MODEL_NAME
            )
            model.to(self.device)
            model.eval()
            self.tokenizer = tokenizer
            self.model = model
            print("Translation model loaded successfully.")

    def translate(self, text: str, target_language: str) -> str:
        """Translate English text into a supported target language."""

        # Validate input text.
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Input text cannot be empty.")

        # Validate target language.
        if target_language not in LANGUAGE_CONFIG:
            supported = ", ".join(LANGUAGE_CONFIG.keys())
            raise ValueError(
                f"Unsupported language: {target_language}. "
                f"Supported languages: {supported}"
            )

        self._ensure_model_loaded()

        # Get the NLLB target language code.
        target_code = LANGUAGE_CONFIG[target_language]["lang_code"]

        # Configure the source language.
        self.tokenizer.src_lang = SOURCE_LANGUAGE_CODE

        # Tokenize the input text.
        inputs = self.tokenizer(
            text.strip(),
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )

        # Move tokenized inputs to the selected device.
        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        # Get the target language token ID.
        target_token_id = self.tokenizer.convert_tokens_to_ids(
            target_code
        )

        if target_token_id == self.tokenizer.unk_token_id:
            raise ValueError(
                f"Invalid NLLB target language code: {target_code}"
            )

        # Generate the translation.
        with torch.inference_mode():
            generated_tokens = self.model.generate(
                **inputs,
                forced_bos_token_id=target_token_id,
                max_new_tokens=200,
                num_beams=4,
            )

        # Convert generated tokens into text.
        translation = self.tokenizer.batch_decode(
            generated_tokens,
            skip_special_tokens=True,
        )[0]

        translation = translation.strip()

        if not translation:
            raise RuntimeError("The translation model returned empty text.")

        return translation


# Load one shared model instance when this module is imported.
# This avoids reloading the model for every translation.
translation_service = TranslationService()


def translate_text(text: str, target_language: str) -> str:
    """Convenience function used by the translation agent."""
    return translation_service.translate(text, target_language)
