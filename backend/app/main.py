from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .config import settings
from .database import (
    ensure_conversation,
    get_recent_context,
    get_runtime_settings,
    init_database,
    save_runtime_settings,
    save_analysis,
    save_message,
)
from .schemas import (
    AnalysisRequest,
    AnalysisResponse,
    BackendSettingsResponse,
    BackendSettingsState,
    BackendSettingsUpdateRequest,
    HealthResponse,
)
from .services.analyzer import SentimentAnalyzer
from .services.bert_sentiment import BertSentimentAnalyzer
from .services.gemini import GeminiSentimentFallback
from .services.safety import DISCLAIMER


bert = BertSentimentAnalyzer(settings.model_dir)
gemini = GeminiSentimentFallback(
    settings.gemini_api_key,
    settings.gemini_model,
    settings.sentiment_labels,
)
analyzer = SentimentAnalyzer(
    bert=bert,
    gemini=gemini,
    confidence_threshold=settings.bert_confidence_threshold,
    allow_gemini_fallback=True,
)
runtime_settings_state = BackendSettingsState(
    enable_bert=True,
    enable_gemini=settings.allow_gemini_fallback,
    gemini_api_key=settings.gemini_api_key,
    gemini_model=settings.gemini_model,
    bert_confidence_threshold=settings.bert_confidence_threshold,
    context_window_messages=settings.context_window_messages,
)

app = FastAPI(title="Mental Health Sentiment Analysis API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _settings_response() -> BackendSettingsResponse:
    state = runtime_settings_state
    return BackendSettingsResponse(
        enable_bert=state.enable_bert,
        enable_gemini=state.enable_gemini,
        gemini_model=state.gemini_model,
        gemini_api_key_set=bool(state.gemini_api_key),
        bert_confidence_threshold=state.bert_confidence_threshold,
        context_window_messages=state.context_window_messages,
        bert_model_loaded=bert.loaded,
        gemini_configured=gemini.configured,
    )


def _load_runtime_settings_state() -> BackendSettingsState:
    defaults = runtime_settings_state.model_dump()
    persisted = get_runtime_settings()
    merged: dict[str, Any] = {**defaults}
    for key in defaults:
        if key in persisted:
            merged[key] = persisted[key]
    try:
        resolved = BackendSettingsState.model_validate(merged)
    except ValidationError:
        resolved = runtime_settings_state
    save_runtime_settings(resolved.model_dump())
    return resolved


@app.on_event("startup")
def startup() -> None:
    global runtime_settings_state
    init_database()
    runtime_settings_state = _load_runtime_settings_state()
    gemini.update_configuration(
        api_key=runtime_settings_state.gemini_api_key,
        model=runtime_settings_state.gemini_model,
    )
    bert.load()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    state = runtime_settings_state
    return HealthResponse(
        status="ok",
        bert_model_loaded=bert.loaded,
        gemini_configured=gemini.configured,
        enable_bert=state.enable_bert,
        enable_gemini=state.enable_gemini,
        database_path=str(settings.database_path),
    )


@app.get("/settings", response_model=BackendSettingsResponse)
def read_settings() -> BackendSettingsResponse:
    return _settings_response()


@app.put("/settings", response_model=BackendSettingsResponse)
def update_settings(payload: BackendSettingsUpdateRequest) -> BackendSettingsResponse:
    global runtime_settings_state
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return _settings_response()

    current = runtime_settings_state.model_dump()
    current.update(updates)
    runtime_settings_state = BackendSettingsState.model_validate(current)
    save_runtime_settings(runtime_settings_state.model_dump())
    gemini.update_configuration(
        api_key=runtime_settings_state.gemini_api_key,
        model=runtime_settings_state.gemini_model,
    )
    if runtime_settings_state.enable_bert and not bert.loaded:
        bert.load()
    return _settings_response()


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_sentiment(payload: AnalysisRequest) -> AnalysisResponse:
    active_settings = runtime_settings_state
    statement = payload.statement.strip()
    conversation_id = ensure_conversation(payload.conversation_id)
    context = get_recent_context(conversation_id, active_settings.context_window_messages)
    message_id = save_message(conversation_id, "user", statement)

    result = await analyzer.analyze(
        statement,
        context,
        enable_bert=active_settings.enable_bert,
        enable_gemini=active_settings.enable_gemini,
        confidence_threshold=active_settings.bert_confidence_threshold,
    )
    all_scores = result.get("all_scores", [])
    raw = result.get("raw")

    save_analysis(
        message_id=message_id,
        label=result["label"],
        confidence=float(result["confidence"]),
        source=result["source"],
        all_scores=all_scores,
        crisis_detected=bool(result["crisis_detected"]),
        recommendation=result["recommendation"],
        raw_response=raw,
    )

    return AnalysisResponse(
        conversation_id=conversation_id,
        message_id=message_id,
        label=result["label"],
        confidence=float(result["confidence"]),
        source=result["source"],
        all_scores=all_scores,
        general_sentiment=result["general_sentiment"],
        mental_health=result["mental_health"],
        crisis_detected=bool(result["crisis_detected"]),
        recommendation=result["recommendation"],
        disclaimer=DISCLAIMER,
        model_status=result.get("reason", bert.status),
        raw=raw,
    )
