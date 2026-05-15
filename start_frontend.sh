#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting frontend server on http://127.0.0.1:5500 ..."
cd "$ROOT_DIR"
exec python3 -m http.server 5500 --directory frontend
