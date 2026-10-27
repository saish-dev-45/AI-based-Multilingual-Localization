"""Manage user-uploaded documents used by the RAG localization mode."""

from pathlib import Path
import tempfile

from app.services.knowledge_base import (
    KNOWLEDGE_DIR,
    SUPPORTED_EXTENSIONS,
    _collection,
    extract_text,
    index_document,
    list_indexed_sources,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB per file


def extract_upload_text(filename: str, content: bytes) -> str:
    """Extract text from an uploaded file WITHOUT indexing it.

    Used for documents the user wants localized (not reference material).
    """
    name = _safe_name(filename)

    if not content:
        raise ValueError(f"'{name}' is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(
            f"'{name}' exceeds the "
            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB size limit."
        )

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / name
        path.write_bytes(content)
        text = extract_text(path)

    text = text.strip()

    if not text:
        raise ValueError(f"No extractable text found in '{name}'.")

    return text


def _safe_name(filename: str) -> str:
    """Strip any path components and validate the extension."""
    name = Path(filename or "").name.strip()

    if not name:
        raise ValueError("Uploaded file has no name.")

    if Path(name).suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type for '{name}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    return name


def save_and_index(filename: str, content: bytes) -> dict:
    """Save an uploaded file and index it into the knowledge base."""
    name = _safe_name(filename)

    if not content:
        raise ValueError(f"'{name}' is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(
            f"'{name}' exceeds the "
            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB size limit."
        )

    path = KNOWLEDGE_DIR / name
    previous = path.read_bytes() if path.exists() else None
    path.write_bytes(content)

    try:
        chunks = index_document(path)
    except Exception:
        # Roll back so an unreadable upload is not left behind.
        if previous is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(previous)
        raise

    return {"name": name, "chunks": chunks, "size": len(content)}


def list_documents() -> list[dict]:
    """List indexed documents with their chunk counts."""
    documents = []

    for source in list_indexed_sources():
        found = _collection.get(
            where={"source": source},
            include=["metadatas"],
        )
        metadatas = found.get("metadatas") or []
        first = metadatas[0] if metadatas else {}
        path = KNOWLEDGE_DIR / source

        documents.append({
            "name": source,
            "chunks": len(metadatas),
            "category": first.get("category", "general"),
            "target_locale": first.get("target_locale", "all"),
            "size": path.stat().st_size if path.exists() else 0,
        })

    return documents


def delete_document(filename: str) -> bool:
    """Remove a document from disk and from the index."""
    name = Path(filename).name
    path = KNOWLEDGE_DIR / name
    existed = path.is_file() or name in list_indexed_sources()

    if path.is_file():
        path.unlink()

    _collection.delete(where={"source": name})

    return existed
