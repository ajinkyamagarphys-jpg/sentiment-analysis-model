from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import pandas as pd
import torch
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)


TEXT_COLUMN_CANDIDATES = [
    "statement",
    "text",
    "message",
    "post",
    "content",
    "tweet",
    "sentence",
]
LABEL_COLUMN_CANDIDATES = [
    "sentiment",
    "label",
    "status",
    "class",
    "emotion",
    "target",
]


class SentimentDataset(Dataset):
    def __init__(self, encodings: dict[str, list[int]], labels: list[int]) -> None:
        self.encodings = encodings
        self.labels = labels

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        item = {key: torch.tensor(value[index]) for key, value in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[index])
        return item

    def __len__(self) -> int:
        return len(self.labels)


def detect_column(columns: list[str], candidates: list[str]) -> str | None:
    normalized = {column.lower().strip(): column for column in columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    for column in columns:
        lowered = column.lower()
        if any(candidate in lowered for candidate in candidates):
            return column
    return None


def load_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    if path.suffix.lower() == ".json":
        return pd.read_json(path)
    raise ValueError("Supported dataset formats: .csv, .xlsx, .xls, .json")


def compute_metrics(eval_prediction: tuple) -> dict[str, float]:
    logits, labels = eval_prediction
    predictions = logits.argmax(axis=-1)
    return {
        "accuracy": accuracy_score(labels, predictions),
        "macro_f1": f1_score(labels, predictions, average="macro"),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune BERT for mental health sentiment classification.")
    parser.add_argument("--data", required=True, help="Path to Kaggle dataset CSV, Excel, or JSON file.")
    parser.add_argument("--text-column", help="Text/statement column name. Auto-detected if omitted.")
    parser.add_argument("--label-column", help="Sentiment/label column name. Auto-detected if omitted.")
    parser.add_argument("--output-dir", default="backend/model_artifacts/bert-sentiment")
    parser.add_argument("--base-model", default="bert-base-uncased")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--test-size", type=float, default=0.15)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_path = Path(args.data).resolve()
    output_dir = Path(args.output_dir).resolve()

    frame = load_table(data_path)
    text_column = args.text_column or detect_column(list(frame.columns), TEXT_COLUMN_CANDIDATES)
    label_column = args.label_column or detect_column(list(frame.columns), LABEL_COLUMN_CANDIDATES)
    if text_column is None or label_column is None:
        raise SystemExit(
            "Could not detect text/label columns. "
            f"Columns found: {list(frame.columns)}. "
            "Run again with --text-column YOUR_TEXT_COLUMN --label-column YOUR_LABEL_COLUMN."
        )

    frame = frame[[text_column, label_column]].dropna()
    frame[text_column] = frame[text_column].astype(str).str.strip()
    frame[label_column] = frame[label_column].astype(str).str.strip()
    frame = frame[(frame[text_column] != "") & (frame[label_column] != "")]
    if frame[label_column].nunique() < 2:
        raise SystemExit("Training needs at least two sentiment labels.")

    label_encoder = LabelEncoder()
    labels = label_encoder.fit_transform(frame[label_column])
    id2label = {index: label for index, label in enumerate(label_encoder.classes_)}
    label2id = {label: index for index, label in id2label.items()}

    label_counts = pd.Series(labels).value_counts()
    stratify_labels = labels if label_counts.min() >= 2 else None
    if stratify_labels is None:
        warnings.warn(
            "At least one label has only one example, so the validation split will not be stratified.",
            stacklevel=2,
        )

    train_texts, validation_texts, train_labels, validation_labels = train_test_split(
        frame[text_column].tolist(),
        labels.tolist(),
        test_size=args.test_size,
        random_state=42,
        stratify=stratify_labels,
    )

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=args.max_length)
    validation_encodings = tokenizer(validation_texts, truncation=True, padding=True, max_length=args.max_length)
    train_dataset = SentimentDataset(train_encodings, train_labels)
    validation_dataset = SentimentDataset(validation_encodings, validation_labels)

    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        num_labels=len(label_encoder.classes_),
        id2label=id2label,
        label2id=label2id,
    )

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        weight_decay=0.01,
        logging_dir=str(output_dir / "logs"),
        report_to=[],
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )
    trainer.train()
    metrics = trainer.evaluate()

    output_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    (output_dir / "training_metadata.json").write_text(
        json.dumps(
            {
                "data_path": str(data_path),
                "text_column": text_column,
                "label_column": label_column,
                "labels": list(label_encoder.classes_),
                "metrics": metrics,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Saved trained BERT model to: {output_dir}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
