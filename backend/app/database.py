from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from .config import PROJECT_DIR, settings


SCHEMA_PATH = PROJECT_DIR / "database" / "schema.sql"


def get_connection() -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection() as connection:
        connection.executescript(schema)


def ensure_conversation(conversation_id: str | None) -> str:
    resolved_id = conversation_id or str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO conversations (id)
            VALUES (?)
            ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            """,
            (resolved_id,),
        )
    return resolved_id


def save_message(conversation_id: str, role: str, content: str) -> str:
    message_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
            (message_id, conversation_id, role, content),
        )
        connection.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conversation_id,),
        )
    return message_id


def save_analysis(
    message_id: str,
    label: str,
    confidence: float,
    source: str,
    all_scores: list[dict[str, Any]],
    crisis_detected: bool,
    recommendation: str,
    raw_response: dict[str, Any] | None,
) -> str:
    analysis_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO analyses (
                id, message_id, label, confidence, source, all_scores_json,
                crisis_detected, recommendation, raw_response_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                message_id,
                label,
                confidence,
                source,
                json.dumps(all_scores),
                int(crisis_detected),
                recommendation,
                json.dumps(raw_response) if raw_response is not None else None,
            ),
        )
    return analysis_id


def get_recent_context(conversation_id: str, limit: int) -> list[dict[str, str]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT role, content
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (conversation_id, limit),
        ).fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
