# AI Interview Coach Backend

This directory contains the FastAPI backend service for the AI Interview Coach application. The backend exposes RESTful endpoints for managing interview sessions, questions, and AI-assisted evaluations.

## Local development

Create a virtual environment (e.g. with `python -m venv .venv`), activate it, then install dependencies:

```bash
pip install -e ".[dev]"
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API is served at `http://127.0.0.1:8000`.
