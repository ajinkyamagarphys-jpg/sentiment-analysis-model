from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")
load_dotenv()


def _resolve_path(value: str, base: Path) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (base / path).resolve()


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _labels_env() -> list[str]:
    raw = os.getenv("SENTIMENT_LABELS", "")
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_path: Path = _resolve_path(os.getenv("DATABASE_PATH", "../database/app.sqlite"), BACKEND_DIR)
    model_dir: Path = _resolve_path(os.getenv("MODEL_DIR", "./model_artifacts/bert-sentiment"), BACKEND_DIR)
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    allow_gemini_fallback: bool = _bool_env("ALLOW_GEMINI_FALLBACK", True)
    bert_confidence_threshold: float = float(os.getenv("BERT_CONFIDENCE_THRESHOLD", "0.58"))
    context_window_messages: int = int(os.getenv("CONTEXT_WINDOW_MESSAGES", "8"))
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")
    sentiment_labels: list[str] | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "sentiment_labels", _labels_env())


settings = Settings()
