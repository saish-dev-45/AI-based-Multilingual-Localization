import os
import sys
from pathlib import Path

# Ensure project root is in sys.path when run directly
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
from langchain_groq import ChatGroq

from app.config import BASE_DIR

load_dotenv(BASE_DIR / ".env")


def get_llm() -> ChatGroq:
    """Create the Groq chat model client."""

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is missing from the .env file."
        )

    model_name = os.getenv(
        "GROQ_MODEL",
        "qwen/qwen3.8-27b",
    )

    return ChatGroq(
        model=model_name,
        groq_api_key=api_key,
        temperature=0.2,
    )


llm = get_llm()