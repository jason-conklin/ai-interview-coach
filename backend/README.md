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

## Seed data

The included `app/seeds/seed_roles_and_questions.json` file now ships level-aware prompts, including hands-on coding exercises that surface when you choose higher seniority targets. If you already have a local database, apply migrations first:

```bash
alembic upgrade head
```

Then reload the seed data into SQLite:

```bash
python -m app.db.init_db
```

Re-running the seeder is idempotent; existing questions are skipped so you can safely refresh when new prompts are added.
