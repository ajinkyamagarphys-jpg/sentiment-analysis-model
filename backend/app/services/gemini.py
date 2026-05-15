from __future__ import annotations

import json
import re
from typing import Any, Optional

import httpx


class GeminiSentimentFallback:
    def __init__(
        self,
        api_key: str,
        model: str,
        labels: Optional[list[str]] = None,
        api_keys: Optional[list[str]] = None,
    ) -> None:
        self.api_key = api_key.strip()
        self.api_keys = self._normalize_keys(api_keys or [])
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
        self._key_cursor = 0

    @property
    def configured(self) -> bool:
        return bool(self._all_keys())

    def update_configuration(
        self,
        api_key: Optional[str] = None,
        api_keys: Optional[list[str]] = None,
        model: Optional[str] = None,
    ) -> None:
        if api_key is not None:
            self.api_key = api_key.strip()
        if api_keys is not None:
            self.api_keys = self._normalize_keys(api_keys)
        if model is not None:
            normalized = model.strip()
            if normalized:
                self.model = normalized
        all_keys = self._all_keys()
        if not all_keys:
            self._key_cursor = 0
        else:
            self._key_cursor = self._key_cursor % len(all_keys)

    async def analyze(self, statement: str, context: list[dict[str, str]]) -> dict[str, Any]:
        keys = self._all_keys()
        if not keys:
            return {
                "available": False,
                "reason": "Gemini API keys are not configured.",
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

        ordered_keys, start_index = self._ordered_keys(keys)
        last_error: Optional[dict[str, Any]] = None

        async with httpx.AsyncClient(timeout=30) as client:
            for index, key in enumerate(ordered_keys):
                headers = {
                    "x-goog-api-key": key,
                    "Content-Type": "application/json",
                }
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    body = response.json()
                    parsed = self._parse_json(self._extract_text(body))
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
                    absolute_index = (start_index + index) % len(keys)
                    self._key_cursor = absolute_index
                    reason = parsed.get("rationale", "Gemini fallback completed.")
                    if index > 0:
                        reason = f"Gemini fallback key used after rate limit. {reason}"
                    return {
                        "available": True,
                        "label": label,
                        "confidence": max(0.0, min(1.0, confidence)),
                        "all_scores": scores,
                        "reason": reason,
                        "raw": parsed,
                    }

                error_msg = self._extract_error_message(response)
                last_error = {
                    "available": False,
                    "reason": f"Gemini API Error ({response.status_code}): {error_msg}",
                    "label": "unknown",
                    "confidence": 0.0,
                    "all_scores": [],
                    "raw": None,
                }
                if self._is_rate_limit(response.status_code, error_msg) and index < len(ordered_keys) - 1:
                    continue
                return last_error

        return last_error or {
            "available": False,
            "reason": "Gemini API keys are not configured.",
            "label": "unknown",
            "confidence": 0.0,
            "all_scores": [],
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

    @staticmethod
    def _normalize_keys(keys: list[str]) -> list[str]:
        cleaned: list[str] = []
        for key in keys:
            value = str(key).strip()
            if not value or value in cleaned:
                continue
            cleaned.append(value)
        return cleaned

    def _all_keys(self) -> list[str]:
        keys: list[str] = []
        if self.api_key:
            keys.append(self.api_key)
        for key in self.api_keys:
            if key and key not in keys:
                keys.append(key)
        return keys

    def _ordered_keys(self, keys: list[str]) -> tuple[list[str], int]:
        if not keys:
            return [], 0
        start = self._key_cursor % len(keys)
        return keys[start:] + keys[:start], start

    @staticmethod
    def _extract_error_message(response: httpx.Response) -> str:
        try:
            error_data = response.json()
            return error_data.get("error", {}).get("message", response.text)
        except Exception:
            return response.text

    @staticmethod
    def _is_rate_limit(status_code: int, message: str) -> bool:
        if status_code == 429:
            return True
        lowered = message.lower()
        indicators = [
            "rate limit",
            "quota",
            "exceeded",
            "resource_exhausted",
            "too many requests",
        ]
        if status_code in {400, 403} and any(token in lowered for token in indicators):
            return True
        return False
