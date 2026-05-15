#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$ROOT_DIR/backend/venv"
if [[ ! -d "$VENV_PATH" && -d "$ROOT_DIR/.venv" ]]; then
  VENV_PATH="$ROOT_DIR/.venv"
fi

if [[ ! -d "$VENV_PATH" ]]; then
  echo "No virtual environment found at backend/venv or .venv. Create one with Python 3.11 or 3.12 first."
  exit 1
fi

source "$VENV_PATH/bin/activate"

PYTHON_VERSION="$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
if [[ "$PYTHON_VERSION" != "3.11" && "$PYTHON_VERSION" != "3.12" ]]; then
  echo "Unsupported Python version: $PYTHON_VERSION. Use Python 3.11 or 3.12."
  exit 1
fi

echo "Starting backend server on http://127.0.0.1:8000 ..."
cd "$ROOT_DIR"
exec python -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
