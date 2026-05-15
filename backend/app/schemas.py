from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class AnalysisRequest(BaseModel):
    statement: str = Field(..., min_length=1, max_length=5000)
    conversation_id: Optional[str] = None


class Score(BaseModel):
    label: str
    score: float


class AnalysisResult(BaseModel):
    label: str
    confidence: float
    source: str
    all_scores: list[Score]
    model_status: str
    raw: Optional[dict[str, Any]] = None


class AnalysisResponse(BaseModel):
    conversation_id: str
    message_id: str
    label: str
    confidence: float
    source: str
    all_scores: list[Score]
    general_sentiment: AnalysisResult
    mental_health: AnalysisResult
    crisis_detected: bool
    recommendation: str
    disclaimer: str
    model_status: str
    raw: Optional[dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    bert_model_loaded: bool
    gemini_configured: bool
    enable_bert: bool
    enable_gemini: bool
    database_path: str


class BackendSettingsState(BaseModel):
    enable_bert: bool = True
    enable_gemini: bool = True
    gemini_api_key: str = Field(default="", max_length=2048)
    gemini_model: str = Field(default="gemini-2.5-flash", min_length=1, max_length=128)
    bert_confidence_threshold: float = Field(default=0.58, ge=0.0, le=1.0)
    context_window_messages: int = Field(default=8, ge=1, le=50)

    @field_validator("gemini_api_key", "gemini_model")
    @classmethod
    def normalize_strings(cls, value: str) -> str:
        return value.strip()


class BackendSettingsUpdateRequest(BaseModel):
    enable_bert: Optional[bool] = None
    enable_gemini: Optional[bool] = None
    gemini_api_key: Optional[str] = Field(default=None, max_length=2048)
    gemini_model: Optional[str] = Field(default=None, max_length=128)
    bert_confidence_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    context_window_messages: Optional[int] = Field(default=None, ge=1, le=50)

    @field_validator("gemini_model")
    @classmethod
    def validate_model(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("gemini_model cannot be blank")
        return normalized

    @field_validator("gemini_api_key")
    @classmethod
    def normalize_api_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip()


class BackendSettingsResponse(BaseModel):
    enable_bert: bool
    enable_gemini: bool
    gemini_model: str
    gemini_api_key_set: bool
    bert_confidence_threshold: float
    context_window_messages: int
    bert_model_loaded: bool
    gemini_configured: bool
