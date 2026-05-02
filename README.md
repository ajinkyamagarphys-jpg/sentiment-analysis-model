# Mental Health Sentiment Analysis

FastAPI + SQLite project for classifying user statements. The backend uses your trained local BERT model for 3-class general sentiment only: `positive`, `neutral`, and `negative`. Gemini is used separately for broader mental-health labels such as anxiety, depression, stress, loneliness, anger, normal, and suicidal.

This tool is for sentiment analysis only. It is not a diagnosis or a replacement for professional or emergency care.

## Project Structure

```text
backend/    FastAPI app, BERT inference, Gemini mental-health analysis, training script
frontend/   Browser UI with no build step
database/   SQLite schema and generated app.sqlite
data/       Place your Kaggle dataset here
```

## Setup

Use Python 3.11 or 3.12 for this project. Python 3.14 is too new for parts of the ML stack; packages such as pandas, torch, and transformers may try to build from source instead of installing prebuilt wheels.

From the project root, create and activate a virtual environment, install dependencies, and create your `.env` file.

### Linux / macOS

```bash
cd /path/to/sentiment-analysis-model

# Prefer 3.11, else use 3.12
python3.11 -m venv .venv || python3.12 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip setuptools wheel
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

### Windows (PowerShell)

```powershell
cd "c:\path\to\sentiment-analysis-model"

# See installed Python launchers
py -0p

# Prefer 3.11, else use 3.12
py -3.11 -m venv .venv
# If that fails, run: py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip setuptools wheel
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

If Python 3.11 is unavailable, use Python 3.12 instead and recreate the environment.

Edit `backend\.env` and set `GEMINI_API_KEY` if you want mental-health labels beyond BERT's `positive`, `neutral`, and `negative`.
Edit `backend/.env` and set `GEMINI_API_KEY` if you want fallback analysis before the BERT model is trained.

## Train BERT

Put your Kaggle file in `data/`, then run (with your virtual environment still active):

For detailed dataset instructions and recommended Kaggle datasets, see `data/DATASET_GUIDE.md`.

```bash
python backend/scripts/train_bert.py --data data/your_dataset.csv
```

The script auto-detects common text columns such as `statement`, `text`, `message`, and common label columns such as `sentiment`, `label`, `status`. If your dataset uses different names, pass them explicitly:

```bash
python backend/scripts/train_bert.py --data data/your_dataset.csv --text-column "statement" --label-column "sentiment"
```

The trained model is saved to `backend/model_artifacts/bert-sentiment`, which the API loads on startup.

## Run

Start the API from the project root (with the virtual environment active):

```bash
uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

Check backend health:

```bash
curl http://127.0.0.1:8000/health
```

Open `frontend/index.html` in a browser, or serve the folder with a static server.
To run the frontend on a local server, open a new terminal window and run:

```bash
cd frontend
python3 -m http.server 5500
```

Then open `http://localhost:5500` in your browser.

## SQLite Context

SQLite stores bounded conversation context in:

```text
database/app.sqlite
```

This is enough for local context windows because the app only reads the most recent `CONTEXT_WINDOW_MESSAGES` rows per conversation. Supabase is not needed unless you later want hosted multi-device users, auth, or realtime collaboration.

## Gemini Mental-Health Labels

Gemini uses Google Gemini REST `generateContent` with the `x-goog-api-key` header. Set:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

With the current dataset, BERT should be treated as general sentiment only. Gemini handles the broader mental-health label because those labels are not present in the Kaggle CSV.
