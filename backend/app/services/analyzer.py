from __future__ import annotations

from typing import Any

from .bert_sentiment import BertSentimentAnalyzer
from .gemini import GeminiSentimentFallback
from .safety import detect_crisis, recommendation_for


class SentimentAnalyzer:
    def __init__(
        self,
        bert: BertSentimentAnalyzer,
        gemini: GeminiSentimentFallback,
        confidence_threshold: float,
        allow_gemini_fallback: bool,
    ) -> None:
        self.bert = bert
        self.gemini = gemini
        self.confidence_threshold = confidence_threshold
        self.allow_gemini_fallback = allow_gemini_fallback

    async def analyze(self, statement: str, context: list[dict[str, str]]) -> dict[str, Any]:
        force_ai = "--force-ai" in statement
        if force_ai:
            statement = statement.replace("--force-ai", "").strip()

        crisis_detected = detect_crisis(statement)
        
        if force_ai:
            bert_result = {
                "label": "skipped",
                "confidence": 0.0,
                "source": "skipped",
                "all_scores": [],
                "model_status": "Skipped due to --force-ai flag",
                "raw": None,
            }
        else:
            bert_result = self._general_sentiment(statement)

        mental_health_result = self._unavailable_mental_health()

        if self.allow_gemini_fallback or force_ai:
            try:
                gemini_result = await self.gemini.analyze(statement, context)
                if gemini_result["available"]:
                    mental_health_result = self._normalize_result(gemini_result, "gemini")
                else:
                    mental_health_result = self._normalize_result(gemini_result, "gemini_error")
                    mental_health_result["model_status"] = gemini_result.get("reason", "Unknown Gemini Error")
            except Exception as exc:
                mental_health_result["source"] = "gemini_error"
                mental_health_result["model_status"] = f"Gemini mental-health analysis failed: {exc}"

        mental_health_result = self._with_safety(mental_health_result, crisis_detected)
        primary = mental_health_result if mental_health_result["source"] != "unavailable" else bert_result

        return {
            "label": primary["label"],
            "confidence": primary["confidence"],
            "source": primary["source"],
            "all_scores": primary["all_scores"],
            "general_sentiment": bert_result,
            "mental_health": mental_health_result,
            "crisis_detected": crisis_detected,
            "recommendation": recommendation_for(crisis_detected),
            "reason": self._combined_status(bert_result, mental_health_result),
            "raw": mental_health_result.get("raw"),
        }

    def _general_sentiment(self, statement: str) -> dict[str, Any]:
        bert_result = self.bert.predict(statement)
        if not bert_result["available"]:
            return {
                "label": "unknown",
                "confidence": 0.0,
                "source": "unavailable",
                "all_scores": [],
                "model_status": bert_result["reason"],
                "raw": None,
            }

        source = "bert" if bert_result["confidence"] >= self.confidence_threshold else "bert_low_confidence"
        return self._normalize_result(bert_result, source)

    @staticmethod
    def _normalize_result(result: dict[str, Any], source: str) -> dict[str, Any]:
        return {
            "label": result.get("label", "unknown"),
            "confidence": float(result.get("confidence", 0.0)),
            "source": source,
            "all_scores": result.get("all_scores", []),
            "model_status": result.get("reason", ""),
            "raw": result.get("raw"),
        }

    @staticmethod
    def _unavailable_mental_health() -> dict[str, Any]:
        return {
            "label": "unknown",
            "confidence": 0.0,
            "source": "unavailable",
            "all_scores": [],
            "model_status": "Gemini is not configured. Set GEMINI_API_KEY for mental-health labels.",
            "raw": None,
        }

    @staticmethod
    def _with_safety(result: dict[str, Any], crisis_detected: bool) -> dict[str, Any]:
        if crisis_detected:
            labels = {item["label"].lower(): item for item in result.get("all_scores", [])}
            if "suicidal" not in labels:
                result["all_scores"] = [{"label": "suicidal", "score": max(result.get("confidence", 0.0), 0.8)}] + result.get("all_scores", [])
            result["label"] = "suicidal"
            result["confidence"] = max(float(result.get("confidence", 0.0)), 0.8)
            if result["source"] == "unavailable":
                result["source"] = "safety_rule"
                result["model_status"] = "Crisis keyword rule detected possible self-harm risk."
        return result

    @staticmethod
    def _combined_status(general: dict[str, Any], mental_health: dict[str, Any]) -> str:
        return (
            f"General sentiment: {general.get('model_status', '')} "
            f"Mental-health signal: {mental_health.get('model_status', '')}"
        ).strip()
