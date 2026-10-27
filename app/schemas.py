
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class LocalizationRequest(BaseModel):
    """Input received by the localization API."""

    model_config = ConfigDict(str_strip_whitespace=True)

    source_text: str = Field(
        min_length=1,
        max_length=10000,
        description="English text to translate and localize.",
    )

    target_language: str = Field(
        default="Hindi",
        description="Target language, such as Hindi or Marathi.",
    )

    target_locale: str | None = Field(
        default=None,
        description="Formatting locale, such as hi-IN or mr-IN.",
    )

    tone: str = Field(
        default="friendly and professional",
        min_length=1,
        max_length=100,
    )

    domain: str = Field(
        default="General",
        description="Content domain / industry (e.g. App UI, E-Commerce, FinTech, Healthcare, Support, Marketing).",
    )

    target_audience: str = Field(
        default="General Public",
        description="Target audience (e.g. General Public, Youth & Students, Corporate Professionals, Elders).",
    )

    formality: str = Field(
        default="Formal & Respectful",
        description="Honorific register (e.g. Formal & Respectful, Warm & Conversational, Casual & Direct).",
    )

    vocabulary_style: str = Field(
        default="Modern Contemporary",
        description="Vocabulary choice (e.g. Modern Contemporary with loanwords, Pure Vernacular Classical, Tech Terms Preserved).",
    )

    additional_instructions: str = Field(
        default="",
        description="Any specific custom instructions, brand names to preserve, or style notes.",
    )

    use_rag: bool = Field(
        default=False,
        description=(
            "If true, ground the localization in the uploaded "
            "knowledge documents (RAG). Otherwise run simple "
            "translation without retrieval."
        ),
    )


class LocalizationResponse(BaseModel):
    """Result returned by the localization API."""

    source_text: str
    target_language: str
    target_locale: str
    tone: str = "formal"
    context_brief: dict[str, Any] = Field(default_factory=dict)
    machine_translation: str
    localized_text: str
    quality_review: dict[str, Any]
    references: list[dict[str, Any]] = Field(default_factory=list)
    retry_count: int
    status: str
    error: str


class ContextSuggestionRequest(BaseModel):
    source_text: str = Field(min_length=1, max_length=5000)
    target_language: str = Field(default="Hindi")


class ContextSuggestionResponse(BaseModel):
    domain: str
    target_audience: str
    formality: str
    vocabulary_style: str
    tone: str
    rationale: str
