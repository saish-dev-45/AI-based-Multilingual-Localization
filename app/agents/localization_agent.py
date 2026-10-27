
import re

from app.services.llm_client import llm
from app.config import DEFAULT_TONE, LANGUAGE_CONFIG, LANGUAGE_GUIDANCE
from app.services.localization_integrity import protect_formatting


class LocalizationAgent:
    """Localizes machine-translated text using an LLM and RAG."""

    def run(
        self,
        source_text: str,
        machine_translation: str,
        target_language: str,
        tone: str = DEFAULT_TONE,
        domain: str = "General",
        target_audience: str = "General Public",
        formality: str = "Formal & Respectful",
        vocabulary_style: str = "Modern Contemporary",
        additional_instructions: str = "",
        retrieved_context: str = "",
        quality_feedback: str = "",
        target_locale: str | None = None,
    ) -> dict:

        if not isinstance(source_text, str) or not source_text.strip():
            raise ValueError("Source text cannot be empty.")

        if not isinstance(machine_translation, str) or not machine_translation.strip():
            raise ValueError("Machine translation cannot be empty.")

        if target_language not in LANGUAGE_CONFIG:
            supported = ", ".join(LANGUAGE_CONFIG.keys())
            raise ValueError(
                f"Unsupported target language: {target_language}. "
                f"Supported languages: {supported}"
            )

        locale = target_locale or LANGUAGE_CONFIG[target_language]["locale"]
        if locale != LANGUAGE_CONFIG[target_language]["locale"]:
            raise ValueError(f"Locale {locale} is not supported for {target_language}.")
        tone = tone.strip() if isinstance(tone, str) and tone.strip() else DEFAULT_TONE

        context = (
            retrieved_context.strip()
            if isinstance(retrieved_context, str) and retrieved_context.strip()
            else "No additional context available."
        )

        lang_guidance = LANGUAGE_GUIDANCE.get(
            target_language,
            "Use natural, grammatically correct language appropriate for the target locale.",
        ).strip()

        protected_source = protect_formatting(source_text)
        protected_translation = protect_formatting(machine_translation)
        # The translation stage is expected to retain the same token order.
        # If it did not, keep it as a draft and let final QA report the issue.
        source_for_prompt = protected_source.text
        translation_for_prompt = protected_translation.text

        prompt = f"""
You are a professional localization expert specializing in cultural adaptation for Indian regional languages.

Localize the text into {target_language} ({locale}).
Dates, numbers, currencies, percentages, and units are protected and will be
formatted with this locale's CLDR conventions after localization. Keep each
protected locale-value placeholder exactly as written.

SOURCE TEXT:
{source_for_prompt}

MACHINE TRANSLATION (DRAFT):
{translation_for_prompt}

LOCALIZATION PERSONA & BRIEF:
- TONE OF VOICE: {tone}
- TARGET AUDIENCE: {target_audience}
- DOMAIN / CONTEXT: {domain}
- FORMALITY & HONORIFIC REGISTER: {formality} (Crucial: for Hindi/Marathi, strictly align pronouns and verb endings like 'आप'/'कीजिए' or 'तुम्ही'/'करा' according to this register)
- VOCABULARY STYLE: {vocabulary_style} (If modern contemporary, use natural, familiar contemporary loanwords in Devanagari script; if pure vernacular, use authentic regional vocabulary)
{f"- SPECIAL INSTRUCTIONS / BRAND NOTES: {additional_instructions}" if additional_instructions and additional_instructions.strip() else ""}

LANGUAGE GUIDANCE:
{lang_guidance}

REFERENCE CONTEXT:
{context}

{f"FEEDBACK FROM PREVIOUS ATTEMPT: {quality_feedback}" if quality_feedback.strip() else ""}

Instructions:
- Use the source text as the authority for meaning.
- Treat the machine translation as a draft and correct errors.
- Write natural, fluent, grammatically correct {target_language} specifically calibrated for the requested Audience ({target_audience}), Domain ({domain}), and Formality ({formality}).
- Preserve the original meaning, facts, names, numbers, and important details.
- Use natural regional expressions instead of literal translations of idioms.
- Match the requested tone and honorific register consistently.
- Use reference context only when relevant.
- Do not add explanations or information absent from the source.
- Keep every ZXQLOCK...QXZ marker exactly as written, including its spelling,
  number, and count. Do not translate, reorder, omit, or duplicate these markers.
- For ICU MessageFormat expressions, preserve argument names, format types,
  plural/select/selectordinal keywords, select keys, exact-number selectors,
  braces, and nested structure. Use plural category keys required by the target
  locale; translate only the human-readable text inside branches.

Return only the final localized text.
"""

        response = llm.invoke(prompt)
        content = response.content

        if isinstance(content, str):
            localized_text = content.strip()
        elif isinstance(content, list):
            localized_text = "".join(
                block.get("text", "") if isinstance(block, dict)
                and block.get("type") == "text"
                else block if isinstance(block, str)
                else ""
                for block in content
            ).strip()
        else:
            localized_text = ""

        localized_text = re.sub(
            r"<think>.*?</think>",
            "",
            localized_text,
            flags=re.DOTALL,
        ).strip()

        if not localized_text:
            raise RuntimeError("LLM returned an empty localization result.")

        localized_text = protected_source.restore(localized_text, strict=False)

        return {
            "source_text": source_text,
            "machine_translation": machine_translation,
            "localized_text": localized_text,
            "target_language": target_language,
            "target_locale": locale,
            "tone": tone,
            "agent": "localization_agent",
        }


localization_agent = LocalizationAgent()
