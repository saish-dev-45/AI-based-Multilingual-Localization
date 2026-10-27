
from app.services.knowledge_base import (
    ensure_knowledge_indexed,
    get_collection,
    get_embedder,
)


def retrieve_context(
    query: str,
    top_k: int = 5,
    target_locale: str | None = None,
) -> list[dict]:
    """Retrieve relevant knowledge using multilingual embeddings."""

    if not query or not query.strip():
        return []

    ensure_knowledge_indexed()

    collection = get_collection()
    count = collection.count()

    if count == 0:
        return []

    # Convert the query into a multilingual embedding.
    embedder = get_embedder()
    query_embedding = embedder.encode(
        query,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    # Retrieve locale-specific knowledge and globally applicable rules.
    where = None
    if target_locale:
        where = {
            "$or": [
                {"target_locale": target_locale},
                {"target_locale": "all"},
            ]
        }

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(max(1, top_k), count),
        where=where,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    documents = results.get("documents", [[]])[0] or []
    metadatas = results.get("metadatas", [[]])[0] or []
    distances = results.get("distances", [[]])[0] or []

    references = []

    for document, metadata, distance in zip(
        documents,
        metadatas,
        distances,
    ):
        references.append({
            "text": document,
            "source": metadata.get("source", "unknown"),
            "category": metadata.get("category", "general"),
            "source_language": metadata.get(
                "source_language", "unknown"
            ),
            "target_locale": metadata.get(
                "target_locale", "all"
            ),
            "distance": float(distance),
        })

    return references


def format_context(references: list[dict]) -> str:
    """Format retrieved passages for the localization prompt."""

    if not references:
        return (
            "No relevant knowledge was retrieved. "
            "Follow the explicit localization requirements."
        )

    sections = []

    for index, reference in enumerate(references, start=1):
        sections.append(
            f"[Reference {index}]\n"
            f"Source: {reference['source']}\n"
            f"Category: {reference['category']}\n"
            f"Content:\n{reference['text']}"
        )

    return "\n\n".join(sections)
