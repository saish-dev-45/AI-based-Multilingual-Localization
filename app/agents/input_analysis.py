from app.config import LANGUAGE_CONFIG


class InputAnalysisAgent:
    """Checks the input before translation and localization."""

    def run(
        self,
        source_text: str,
        target_language: str,
        target_locale: str | None = None,
    ) -> dict:
        if not isinstance(source_text, str) or not source_text.strip():
            raise ValueError("Source text cannot be empty.")

        source_text = source_text.strip()

        if target_language not in LANGUAGE_CONFIG:
            supported = ", ".join(LANGUAGE_CONFIG.keys())
            raise ValueError(
                f"Unsupported target language: {target_language}. "
                f"Supported languages: {supported}"
            )

        locale = target_locale or LANGUAGE_CONFIG[target_language]["locale"]
        if locale != LANGUAGE_CONFIG[target_language]["locale"]:
            raise ValueError(
                f"Locale {locale} is not supported for {target_language}."
            )

        return {
            "source_text": source_text,
            "target_language": target_language,
            "target_locale": locale,
            "agent": "input_analysis_agent",
        }


input_analysis_agent = InputAnalysisAgent()
