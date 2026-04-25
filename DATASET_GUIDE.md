# Dataset Guide

This project trains a BERT classifier from a local dataset file placed in the `data/` folder.

## 1) What your dataset must contain

Your file should have:

- one text column (the statement/message to classify)
- one label column (sentiment/class)
- at least 2 unique labels

Supported file formats:

- `.csv`
- `.xlsx`
- `.xls`
- `.json`

The training script auto-detects common column names.

Text column candidates:

- `statement`
- `text`
- `message`
- `post`
- `content`
- `tweet`
- `sentence`

Label column candidates:

- `sentiment`
- `label`
- `status`
- `class`
- `emotion`
- `target`

If auto-detection fails, pass explicit column names using `--text-column` and `--label-column`.

## 2) Get data from Kaggle (recommended)

### A. Create Kaggle API token

1. Sign in to Kaggle.
2. Open Account settings.
3. Click Create New API Token.
4. This downloads `kaggle.json`.

### B. Configure Kaggle CLI

Install in your active virtual environment:

```bash
pip install kaggle
```

macOS / Linux:

```bash
mkdir -p ~/.kaggle
cp /path/to/kaggle.json ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.kaggle" | Out-Null
Copy-Item "C:\path\to\kaggle.json" "$env:USERPROFILE\.kaggle\kaggle.json"
```

### C. Download into this project

Run from the project root.

```bash
kaggle datasets download -d OWNER/DATASET-SLUG -p data
unzip data/DATASET-SLUG.zip -d data
```

Windows PowerShell unzip:

```powershell
Expand-Archive -Path "data\DATASET-SLUG.zip" -DestinationPath "data" -Force
```

## 3) Suggested Kaggle datasets

These 3 are good starting points and confirmed Kaggle slugs.

### 1. Sentiment140 (large Twitter dataset) <== use this (84% accuracy)

- Kaggle: https://www.kaggle.com/datasets/kazanova/sentiment140
- CLI:

```bash
kaggle datasets download -d kazanova/sentiment140 -p data
```

- Notes:
  - very large (good for stronger training)
  - common columns include `text` and `target`

### 2. Twitter US Airline Sentiment (smaller and quick to train)

- Kaggle: https://www.kaggle.com/datasets/crowdflower/twitter-airline-sentiment
- CLI:

```bash
kaggle datasets download -d crowdflower/twitter-airline-sentiment -p data
```

- Notes:
  - much smaller than Sentiment140
  - useful for fast first runs and debugging your pipeline

### 3. Sentiment Analysis for Financial News (clean 2-column format)

- Kaggle: https://www.kaggle.com/datasets/ankurzing/sentiment-analysis-for-financial-news
- CLI:

```bash
kaggle datasets download -d ankurzing/sentiment-analysis-for-financial-news -p data
```

- Notes:
  - simple format (`News Headline`, `Sentiment`)
  - good for testing explicit column mapping

## 4) Train with your downloaded file

Example:

```bash
python backend/scripts/train_bert.py --data data/your_dataset.csv
```

Explicit column mapping example:

```bash
python backend/scripts/train_bert.py --data data/your_dataset.csv --text-column "statement" --label-column "sentiment"
```

If you want a mental-health-specific dataset, search Kaggle for `mental health sentiment`, then use the same train command above.
