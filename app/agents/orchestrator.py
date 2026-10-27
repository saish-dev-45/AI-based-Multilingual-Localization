
from typing import Any, TypedDict

from langgraph.graph import StateGraph, START, END

from app.agents.input_analysis import input_analysis_agent
from app.agents.translation_agent import translation_agent
from app.agents.localization_agent import localization_agent
from app.agents.quality_review_agent import quality_review_agent

from app.config import DEFAULT_TONE, LANGUAGE_CONFIG

from app.services.retrieval_service import (
    retrieve_context,
    format_context,
)
from app.services.localization_integrity import protect_formatting
from app.services.locale_formatting import LocaleFormatting, prepare_locale_formatting


MAX_RETRIES = 1  # one retry after a failed quality review


class LocalizationState(TypedDict):
    source_text: str
    formatting_source_text: str
    source_protection: Any
    locale_formatting: LocaleFormatting
    target_language: str
    target_locale: str
    tone: str
    domain: str
    target_audience: str
    formality: str
    vocabulary_style: str
    additional_instructions: str
    use_rag: bool

    analysis: dict[str, Any]
    retrieved_context: str
    references: list[dict[str, Any]]

    machine_translation: str
    localized_text: str

    quality_review: dict[str, Any]
    quality_feedback: str   # issues from the last review, fed back on retry

    retry_count: int
    status: str
    error: str


def analyze_input(state: LocalizationState) -> dict:
    result = input_analysis_agent.run(
        source_text=state["source_text"],
        target_language=state["target_language"],
        target_locale=state["target_locale"],
    )

    return {
        "source_text": result["source_text"],
        "analysis": result,
        "tone": state.get("tone") or DEFAULT_TONE,
        "status": "input_analyzed",
        "error": "",
    }


def retrieve_knowledge(state: LocalizationState) -> dict:
    """Retrieve relevant glossary entries and localization guidelines."""

    if not state.get("use_rag", True):
        return {
            "retrieved_context": "",
            "references": [],
            "status": "knowledge_skipped",
        }

    language_config = LANGUAGE_CONFIG.get(
        state["target_language"], {}
    )
    target_locale = state["target_locale"] or language_config.get("locale", "all")

    # Keep the query short: the embedding model truncates long input.
    query = (
        f"{state['source_text'][:800]}\n"
        f"Target language: {state['target_language']}. "
        f"Tone: {state['tone']}."
    )

    references = retrieve_context(
        query=query,
        top_k=5,
        target_locale=target_locale,
    )

    return {
        "retrieved_context": format_context(references),
        "references": references,
        "status": "knowledge_retrieved",
    }


def translate(state: LocalizationState) -> dict:
    result = translation_agent.run(
        source_text=state["formatting_source_text"],
        target_language=state["target_language"],
    )

    return {
        "machine_translation": result["machine_translation"],
        "status": "translated",
    }


def localize(state: LocalizationState) -> dict:
    feedback = state.get("quality_feedback", "") or ""
    result = localization_agent.run(
        source_text=state["formatting_source_text"],
        machine_translation=state["machine_translation"],
        target_language=state["target_language"],
        target_locale=state["target_locale"],
        tone=state.get("tone", DEFAULT_TONE),
        domain=state.get("domain", "General"),
        target_audience=state.get("target_audience", "General Public"),
        formality=state.get("formality", "Formal & Respectful"),
        vocabulary_style=state.get("vocabulary_style", "Modern Contemporary"),
        additional_instructions=state.get("additional_instructions", ""),
        retrieved_context=state.get("retrieved_context", ""),
        quality_feedback=feedback,
    )

    localized_text = state["locale_formatting"].restore(result["localized_text"])
    localized_text = state["source_protection"].restore(localized_text, strict=False)
    return {
        "localized_text": localized_text,
        "status": "localized",
    }


def review_quality(state: LocalizationState) -> dict:
    review = quality_review_agent.run(
        source_text=state["source_text"],
        localized_text=state["localized_text"],
        target_language=state["target_language"],
        target_locale=state["target_locale"],
    )

    return {
        "quality_review": review,
        "status": (
            "completed" if review["overall_pass"]
            else "quality_review_failed"
        ),
    }


def route_after_quality_review(state: LocalizationState) -> str:
    if state["quality_review"]["overall_pass"]:
        return "success"

    if state["retry_count"] < MAX_RETRIES:
        return "retry_localization"

    return "failed"


def retry_localization(state: LocalizationState) -> dict:
    """Collect quality issues from the failed review and feed them back."""
    review = state.get("quality_review", {})
    issues = review.get("issues", [])
    feedback_lines = [f"- {issue}" for issue in issues if issue]
    feedback = (
        "The previous localization attempt failed quality review.\n"
        "Fix the following specific issues in your next attempt:\n"
        + ("\n".join(feedback_lines) if feedback_lines
           else "- Overall quality was below the acceptable threshold.")
    )
    return {
        "retry_count": state["retry_count"] + 1,
        "quality_review": {},
        "quality_feedback": feedback,
        "status": "retrying",
    }


def finish_success(state: LocalizationState) -> dict:
    machine_translation = state["locale_formatting"].restore(
        state["machine_translation"]
    )
    machine_translation = state["source_protection"].restore(
        machine_translation, strict=False
    )
    return {
        "machine_translation": machine_translation,
        "status": "completed",
        "error": "",
    }


def finish_failure(state: LocalizationState) -> dict:
    reasons = []
    review = state.get("quality_review", {})

    if review and not review.get("overall_pass", False):
        reasons.extend(review.get("issues", []))

    if not reasons:
        reasons.append("Quality review failed after retries.")

    machine_translation = state["locale_formatting"].restore(
        state["machine_translation"]
    )
    machine_translation = state["source_protection"].restore(
        machine_translation, strict=False
    )
    return {
        "machine_translation": machine_translation,
        "status": "failed",
        "error": "; ".join(str(reason) for reason in reasons),
    }


def build_localization_graph():
    graph = StateGraph(LocalizationState)

    graph.add_node("input_analysis", analyze_input)
    graph.add_node("retrieve_knowledge", retrieve_knowledge)
    graph.add_node("translation", translate)
    graph.add_node("localization", localize)
    graph.add_node("quality_review", review_quality)
    graph.add_node("retry_localization", retry_localization)
    graph.add_node("success", finish_success)
    graph.add_node("failed", finish_failure)

    graph.add_edge(START, "input_analysis")
    graph.add_edge("input_analysis", "retrieve_knowledge")
    graph.add_edge("retrieve_knowledge", "translation")
    graph.add_edge("translation", "localization")
    graph.add_edge("localization", "quality_review")

    graph.add_conditional_edges(
        "quality_review",
        route_after_quality_review,
        {
            "success": "success",
            "retry_localization": "retry_localization",
            "failed": "failed",
        },
    )

    graph.add_edge("retry_localization", "localization")
    graph.add_edge("success", END)
    graph.add_edge("failed", END)

    return graph.compile()


localization_graph = build_localization_graph()


def run_localization(
    source_text: str,
    target_language: str = "Hindi",
    tone: str = DEFAULT_TONE,
    domain: str = "General",
    target_audience: str = "General Public",
    formality: str = "Formal & Respectful",
    vocabulary_style: str = "Modern Contemporary",
    additional_instructions: str = "",
    use_rag: bool = True,
    target_locale: str | None = None,
) -> dict:
    if target_language not in LANGUAGE_CONFIG:
        supported = ", ".join(LANGUAGE_CONFIG)
        raise ValueError(
            f"Unsupported target language: {target_language}. Supported: {supported}"
        )
    resolved_locale = target_locale or LANGUAGE_CONFIG[target_language]["locale"]
    if resolved_locale != LANGUAGE_CONFIG[target_language]["locale"]:
        raise ValueError(f"Locale {resolved_locale} is not supported for {target_language}.")

    source_protection = protect_formatting(source_text)
    locale_formatting = prepare_locale_formatting(
        source_protection.text, resolved_locale
    )
    initial_state: LocalizationState = {
        "source_text": source_text,
        "formatting_source_text": locale_formatting.masked_text,
        "source_protection": source_protection,
        "locale_formatting": locale_formatting,
        "target_language": target_language,
        "target_locale": resolved_locale,
        "tone": tone,
        "domain": domain,
        "target_audience": target_audience,
        "formality": formality,
        "vocabulary_style": vocabulary_style,
        "additional_instructions": additional_instructions,
        "use_rag": use_rag,
        "analysis": {},
        "retrieved_context": "",
        "references": [],
        "machine_translation": "",
        "localized_text": "",
        "quality_review": {},
        "quality_feedback": "",
        "retry_count": 0,
        "status": "started",
        "error": "",
    }

    return localization_graph.invoke(initial_state)
