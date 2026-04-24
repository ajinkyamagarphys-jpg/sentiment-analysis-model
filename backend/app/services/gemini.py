from __future__ import annotations

import json
import re
from typing import Any

import httpx


class GeminiSentimentFallback:
    def __init__(self, api_key: str, model: str, labels: list[str] | None = None) -> None:
        self.api_key = api_key
        self.model = model
        self.labels = labels or [
            "normal",
            "anxiety",
            "depression",
            "stress",
            "loneliness",
            "anger",
            "positive",
            "suicidal",
        ]

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def analyze(self, statement: str, context: list[dict[str, str]]) -> dict[str, Any]:
        if not self.configured:
            return {
                "available": False,
                "reason": "GEMINI_API_KEY is not configured.",
                "label": "unknown",
                "confidence": 0.0,
                "all_scores": [],
            }

        prompt = self._build_prompt(statement, context)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            body = response.json()

        text = self._extract_text(body)
        parsed = self._parse_json(text)
        scores = parsed.get("all_scores", [])
        if isinstance(scores, dict):
            scores = [{"label": label, "score": float(score)} for label, score in scores.items()]
        scores = [
            {"label": str(item.get("label", "unknown")), "score": float(item.get("score", 0.0))}
            for item in scores
            if isinstance(item, dict)
        ]
        scores.sort(key=lambda item: item["score"], reverse=True)

        label = str(parsed.get("label") or (scores[0]["label"] if scores else "unknown"))
        confidence = float(parsed.get("confidence") or (scores[0]["score"] if scores else 0.0))
        return {
            "available": True,
            "label": label,
            "confidence": max(0.0, min(1.0, confidence)),
            "all_scores": scores,
            "reason": parsed.get("rationale", "Gemini fallback completed."),
            "raw": parsed,
        }

    def _build_prompt(self, statement: str, context: list[dict[str, str]]) -> str:
        labels = ", ".join(self.labels)
        context_text = "\n".join(
            f"{item['role']}: {item['content']}" for item in context[-8:]
        ) or "No prior context."
        return f"""
You classify sentiment for a mental-health support application.
Use only these labels unless the text truly does not fit: {labels}.
Return strict JSON with:
- label: string
- confidence: number from 0 to 1
- all_scores: array of objects with label and score
- rationale: short string

Do not diagnose. Do not provide therapy. If the statement suggests self-harm, label it suicidal.

Conversation context:
{context_text}

Current user statement:
{statement}
""".strip()

    @staticmethod
    def _extract_text(body: dict[str, Any]) -> str:
        candidates = body.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned no candidates.")
        parts = candidates[0].get("content", {}).get("parts", [])
        texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        return "\n".join(texts).strip()

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
        return json.loads(cleaned)
