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
        crisis_detected = detect_crisis(statement)
        bert_result = self.bert.predict(statement)

        should_fallback = (
            self.allow_gemini_fallback
            and (
                not bert_result["available"]
                or bert_result["confidence"] < self.confidence_threshold
            )
        )

        if should_fallback:
            try:
                gemini_result = await self.gemini.analyze(statement, context)
                if gemini_result["available"]:
                    return self._with_safety(gemini_result, "gemini_fallback", crisis_detected)
            except Exception as exc:
                if bert_result["available"]:
                    bert_result["reason"] = f"{bert_result['reason']} Gemini fallback failed: {exc}"
                else:
                    bert_result["reason"] = f"Gemini fallback failed: {exc}"

        if bert_result["available"]:
            source = "bert" if bert_result["confidence"] >= self.confidence_threshold else "bert_low_confidence"
            return self._with_safety(bert_result, source, crisis_detected)

        return self._with_safety(
            {
                "label": "unknown",
                "confidence": 0.0,
                "all_scores": [],
                "reason": bert_result["reason"],
            },
            "unavailable",
            crisis_detected,
        )

    @staticmethod
    def _with_safety(result: dict[str, Any], source: str, crisis_detected: bool) -> dict[str, Any]:
        if crisis_detected:
            labels = {item["label"].lower(): item for item in result.get("all_scores", [])}
            if "suicidal" not in labels:
                result["all_scores"] = [{"label": "suicidal", "score": max(result.get("confidence", 0.0), 0.8)}] + result.get("all_scores", [])
            result["label"] = "suicidal"
            result["confidence"] = max(float(result.get("confidence", 0.0)), 0.8)

        result["source"] = source
        result["crisis_detected"] = crisis_detected
        result["recommendation"] = recommendation_for(crisis_detected)
        return result
