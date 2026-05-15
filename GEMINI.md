# MindTone: Mental Health Sentiment Analysis

A hybrid sentiment analysis application that combines local BERT-based classification with Gemini-powered mental health labeling.

## Architecture

- **Backend:** FastAPI (Python 3.11/3.12)
  - **Inference:** Local BERT model (transformers) for general sentiment (pos/neu/neg).
  - **Fallback/Enrichment:** Google Gemini API for fine-grained mental health labels (anxiety, depression, etc.).
  - **Database:** SQLite for storing conversation history and analysis results.
- **Frontend:** Vanilla HTML/CSS/JavaScript. No build step required.
- **Data Pipeline:** Custom training script to fine-tune BERT on CSV/Excel datasets.

## Project Structure

- `backend/`: FastAPI application and ML scripts.
  - `app/`: Main application logic, services, and database interaction.
  - `scripts/`: BERT training utilities.
  - `model_artifacts/`: Location where the trained BERT model is saved.
- `frontend/`: Web-based user interface.
- `database/`: SQLite schema and database file.
- `data/`: Directory for input datasets (e.g., from Kaggle).

## Core Commands

### Setup
1. **Create Virtual Environment:**
   ```bash
   python3.11 -m venv .venv
   source .venv/bin/activate
   ```
2. **Install Dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```
3. **Environment Variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env to add GEMINI_API_KEY
   ```

### Training
Train the BERT model with a local dataset:
```bash
python backend/scripts/train_bert.py --data data/your_dataset.csv
```

### Running
- **Backend:** `./start_backend.sh` (Starts FastAPI on `http://127.0.0.1:8000`)
- **Frontend:** `./start_frontend.sh` (Starts a static server on `http://127.0.0.1:5500`)

## Development Conventions

- **Python Version:** Use Python 3.11 or 3.12. Avoid 3.14 due to ML library compatibility issues.
- **Type Safety:** Use Python type hints and `from __future__ import annotations`.
- **Configuration:** Settings are managed in `backend/app/config.py`.
- **Services:** Logic is encapsulated in the `backend/app/services/` directory.
- **Frontend:** Keep it simple with vanilla JavaScript. Use `fetch` for API calls and manage state locally.
- **Security:** Never commit `.env` files or API keys. Ensure `database/app.sqlite` is ignored by git if it contains sensitive user data.

## Key Files

- `backend/app/main.py`: FastAPI entry point and route definitions.
- `backend/app/services/analyzer.py`: Orchestrates BERT and Gemini analysis logic.
- `backend/app/services/bert_sentiment.py`: Handles local BERT model inference.
- `backend/app/services/gemini.py`: Interface for Google Gemini API.
- `frontend/js/app.js`: Main frontend logic and API interaction.
- `database/schema.sql`: SQL definitions for conversations, messages, and analyses.
