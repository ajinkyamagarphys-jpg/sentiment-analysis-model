FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /code

# Copy requirements and install dependencies
COPY backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code and the database schema
# (This includes backend/model_artifacts so the trained BERT model is present)
COPY ./backend /code/backend
COPY ./database /code/database

# Expose the port Hugging Face Spaces expects
EXPOSE 7860

# Run the FastAPI application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
