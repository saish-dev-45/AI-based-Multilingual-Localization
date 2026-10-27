from app.services.translator import translate_text
from app.services.localization_integrity import protect_formatting
from app.config import LANGUAGE_CONFIG


class TranslationAgent:
    """Agent responsible for machine translation using NLLB."""

    def run(self, source_text: str, target_language: str) -> dict:
        if not isinstance(source_text, str) or not source_text.strip():
            raise ValueError("Source text cannot be empty.")

        if target_language not in LANGUAGE_CONFIG:
            supported = ", ".join(LANGUAGE_CONFIG.keys())
            raise ValueError(
                f"Unsupported target language: {target_language}. "
                f"Supported languages: {supported}"
            )

        protected = protect_formatting(source_text)
        translated_masked = translate_text(
            protected.text,
            target_language,
        )
        # Restore all markers that survived translation. Any lost marker is
        # caught by the deterministic quality review after localization.
        translated_text = protected.restore(translated_masked, strict=False)

        return {
            "source_text": source_text,
            "machine_translation": translated_text,
            "target_language": target_language,
            "target_locale": LANGUAGE_CONFIG[target_language]["locale"],
            "agent": "translation_agent",
        }


# Reuse one agent instance throughout the application.
translation_agent = TranslationAgent()
