import json
import re

from app.services.llm_client import llm
from app.config import LANGUAGE_CONFIG, LANGUAGE_GUIDANCE
from app.services.localization_integrity import validate_localization


class QualityReviewAgent:
    """Checks the quality of localized text."""

    def run(
        self,
        source_text: str,
        localized_text: str,
        target_language: str,
        target_locale: str | None = None,
    ) -> dict:

        if not isinstance(source_text, str) or not source_text.strip():
            raise ValueError("Source text cannot be empty.")

        if not isinstance(localized_text, str) or not localized_text.strip():
            raise ValueError("Localized text cannot be empty.")

        if target_language not in LANGUAGE_CONFIG:
            raise ValueError(f"Unsupported target language: {target_language}")

        locale = target_locale or LANGUAGE_CONFIG[target_language]["locale"]
        if locale != LANGUAGE_CONFIG[target_language]["locale"]:
            raise ValueError(f"Locale {locale} is not supported for {target_language}.")
        guidance = LANGUAGE_GUIDANCE.get(
            target_language,
            "Use natural and grammatically correct language.",
        )
        integrity = validate_localization(source_text, localized_text, locale)

        prompt = f"""
You are a localization quality reviewer.

Compare the localized text with the original source text.

SOURCE TEXT:
{source_text}

LOCALIZED TEXT:
{localized_text}

TARGET LANGUAGE: {target_language}
TARGET LOCALE: {locale}

LANGUAGE GUIDANCE:
{guidance}

Check:
- Is the original meaning preserved?
- Is the text natural and fluent?
- Is the grammar correct?
- Is the language appropriate for the target locale?
- Treat any changed, missing, added, or reordered placeholder, URL, or HTML
  tag as a critical issue.
- Check ICU MessageFormat argument names, types, selector keys and nesting.
- Check ICU plural/selectordinal expressions include every plural category
  required by the target locale's CLDR rules, and always include "other".

Give each score from 1 to 5.
If the meaning has changed or any score is below 3, the text must fail.
List specific problems and suggested corrections.

Return only valid JSON in this format:
{{
    "meaning_preserved": true,
    "fluency_score": 5,
    "grammar_score": 5,
    "locale_suitability_score": 5,
    "overall_pass": true,
    "issues": []
}}
"""

        response = llm.invoke(prompt)
        content = response.content

        if isinstance(content, list):
            content = "".join(
                block.get("text", "") if isinstance(block, dict)
                else block if isinstance(block, str)
                else ""
                for block in content
            )

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("LLM returned an empty quality review.")

        content = re.sub(
            r"<think>.*?</think>", "", content, flags=re.DOTALL
        ).strip()
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content).strip()

        try:
            review = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("LLM returned invalid review JSON.") from exc

        score_keys = [
            "fluency_score",
            "grammar_score",
            "locale_suitability_score",
        ]

        required_keys = {
            "meaning_preserved",
            *score_keys,
            "overall_pass",
            "issues",
        }

        if not required_keys.issubset(review):
            raise ValueError("Quality review is missing required fields.")

        for key in score_keys:
            score = review[key]

            if (
                isinstance(score, bool)
                or not isinstance(score, (int, float))
                or not 1 <= score <= 5
                or int(score) != score
            ):
                raise ValueError(f"{key} must be an integer from 1 to 5.")

            review[key] = int(score)

        if not isinstance(review["meaning_preserved"], bool):
            raise ValueError("meaning_preserved must be a boolean.")

        if not isinstance(review["issues"], list):
            raise ValueError("issues must be a list.")

        review["formatting_preserved"] = integrity["formatting_preserved"]
        review["icu_valid"] = integrity["icu_valid"]
        if integrity["issues"]:
            review["issues"].extend(integrity["issues"])

        review["overall_pass"] = (
            review["meaning_preserved"]
            and all(review[key] >= 3 for key in score_keys)
            and review["formatting_preserved"]
            and review["icu_valid"]
        )

        review["agent"] = "quality_review_agent"
        return review


quality_review_agent = QualityReviewAgent()
