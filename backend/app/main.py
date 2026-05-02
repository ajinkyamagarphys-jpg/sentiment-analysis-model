from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import (
    ensure_conversation,
    get_recent_context,
    init_database,
    save_analysis,
    save_message,
)
from .schemas import AnalysisRequest, AnalysisResponse, HealthResponse
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
    allow_gemini_fallback=settings.allow_gemini_fallback,
)

app = FastAPI(title="Mental Health Sentiment Analysis API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_database()
    bert.load()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        bert_model_loaded=bert.loaded,
        gemini_configured=gemini.configured,
        database_path=str(settings.database_path),
    )


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_sentiment(payload: AnalysisRequest) -> AnalysisResponse:
    statement = payload.statement.strip()
    conversation_id = ensure_conversation(payload.conversation_id)
    context = get_recent_context(conversation_id, settings.context_window_messages)
    message_id = save_message(conversation_id, "user", statement)

    result = await analyzer.analyze(statement, context)
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
