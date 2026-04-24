from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    statement: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str | None = None


class Score(BaseModel):
    label: str
    score: float


class AnalysisResponse(BaseModel):
    conversation_id: str
    message_id: str
    label: str
    confidence: float
    source: str
    all_scores: list[Score]
    crisis_detected: bool
    recommendation: str
    disclaimer: str
    model_status: str
    raw: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    status: str
    bert_model_loaded: bool
    gemini_configured: bool
    database_path: str
