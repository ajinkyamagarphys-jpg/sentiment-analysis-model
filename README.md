# Mental Health Sentiment Analysis

FastAPI + SQLite + BERT fine-tuning project for classifying user statements. The backend uses your trained local BERT model first, then falls back to Gemini when BERT is missing or below the configured confidence threshold.

This tool is for sentiment analysis only. It is not a diagnosis or a replacement for professional or emergency care.

## Project Structure

```text
backend/    FastAPI app, BERT inference, Gemini fallback, training script
frontend/   Browser UI with no build step
database/   SQLite schema and generated app.sqlite
data/       Place your Kaggle dataset here
```

## Setup

Use Python 3.11 or 3.12 for this project. Python 3.14 is too new for parts of the ML stack; packages such as pandas, torch, and transformers may try to build from source instead of installing prebuilt wheels.

Check installed Python launchers:

```powershell
py -0p
```

Create the virtual environment with Python 3.11 if it is available:

```powershell
cd "c:\Users\ajink\Desktop\sentiment analysis model"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

If `py -3.11` is not available, install Python 3.11 or 3.12 first, then recreate the virtual environment.

Edit `backend\.env` and set `GEMINI_API_KEY` if you want fallback analysis before the BERT model is trained.

## Train BERT

Put your Kaggle file in `data/`, then run:

```powershell
python backend\scripts\train_bert.py --data data\your_dataset.csv
```

The script auto-detects common text columns such as `statement`, `text`, `message`, and common label columns such as `sentiment`, `label`, `status`. If your dataset uses different names, pass them explicitly:

```powershell
python backend\scripts\train_bert.py --data data\your_dataset.csv --text-column "statement" --label-column "sentiment"
```

The trained model is saved to `backend\model_artifacts\bert-sentiment`, which the API loads on startup.

## Run

Start the API:

```powershell
uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

Open `frontend\index.html` in a browser, or serve the folder with any static server. The UI calls `http://localhost:8000`.

## SQLite Context

SQLite stores bounded conversation context in:

```text
database/app.sqlite
```

This is enough for local context windows because the app only reads the most recent `CONTEXT_WINDOW_MESSAGES` rows per conversation. Supabase is not needed unless you later want hosted multi-device users, auth, or realtime collaboration.

## Gemini Fallback

The fallback uses Google Gemini REST `generateContent` with the `x-goog-api-key` header. Set:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

If BERT is trained and confident, Gemini is not called.
