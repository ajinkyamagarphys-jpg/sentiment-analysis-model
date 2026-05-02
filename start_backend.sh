#!/bin/bash
echo "Starting backend server..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
