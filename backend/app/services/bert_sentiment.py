from __future__ import annotations

from pathlib import Path
from typing import Any


class BertSentimentAnalyzer:
    def __init__(self, model_dir: Path) -> None:
        self.model_dir = model_dir
        self.tokenizer: Any | None = None
        self.model: Any | None = None
        self.torch: Any | None = None
        self.status = "BERT model not loaded. Train first with backend/scripts/train_bert.py."

    @property
    def loaded(self) -> bool:
        return self.tokenizer is not None and self.model is not None and self.torch is not None

    def load(self) -> None:
        if not (self.model_dir / "config.json").exists():
            self.status = f"No trained BERT model found at {self.model_dir}."
            return

        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_dir)
            self.model.eval()
            self.torch = torch
            labels = getattr(self.model.config, "id2label", {})
            self.status = f"BERT model loaded with labels: {', '.join(labels.values())}"
        except Exception as exc:
            self.status = f"Could not load BERT model: {exc}"
            self.tokenizer = None
            self.model = None
            self.torch = None

    def predict(self, text: str) -> dict[str, Any]:
        if not self.loaded:
            return {
                "available": False,
                "reason": self.status,
                "label": "unknown",
                "confidence": 0.0,
                "all_scores": [],
            }

        assert self.tokenizer is not None
        assert self.model is not None
        assert self.torch is not None

        encoded = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=256,
            return_tensors="pt",
        )
        with self.torch.no_grad():
            outputs = self.model(**encoded)
            probabilities = self.torch.softmax(outputs.logits, dim=-1)[0]

        id2label = self.model.config.id2label
        scores = [
            {"label": id2label[index], "score": float(score)}
            for index, score in enumerate(probabilities.tolist())
        ]
        scores.sort(key=lambda item: item["score"], reverse=True)
        top = scores[0]
        return {
            "available": True,
            "label": top["label"],
            "confidence": top["score"],
            "all_scores": scores,
            "reason": self.status,
        }
