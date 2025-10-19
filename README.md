# AI Interview Coach
3. Open a PR with screenshots or recordings if the UI changes.
2. Run `pre-commit run --all-files` before pushing.
## Local dev

```bash
python -m venv .venv
pip install -r backend/requirements.txt
npm ci --prefix frontend
npm run dev --prefix frontend
```

3. Open a PR with screenshots or recordings if the UI changes.
# AI Interview Coach

AI Interview Coach is a full-stack practice environment that pairs a FastAPI backend with a modern React/Vite frontend. Candidates can run mock interviews by role, record their answers, receive rubric-driven AI feedback, and review previous sessions.

## Highlights

- Role-aware interview flows for Software Developer, Full-Stack Developer, Data Engineer, and Cyber Analyst.
- AI evaluation service (OpenAI-compatible) with offline heuristics fallback and tiered readiness scoring.
- Session history with detailed summaries, timing metrics, and improvement suggestions.
- Consent & privacy guardrails (local storage disclosure, educational disclaimer, no hiring promises).
- Tooling: FastAPI + SQLAlchemy + Alembic, React + TypeScript + Tailwind, React Query, Vitest, PyTest, Ruff, Black, ESLint, Prettier, GitHub Actions, Docker Compose.

## Architecture

```
[ React + Vite + Tailwind ]
          |  (REST via Axios / React Query)
          v
[ FastAPI Service ] --> domain services --> [ LLM Evaluation (OpenAI) ]
          |
          v
[ SQLAlchemy ORM ]
          |
          v
[ SQLite (dev) / PostgreSQL (prod) ]
```

## Prerequisites

- Python **3.10+** (for backend).
- Node.js **18.17+** (Node 20 recommended for modern tooling).
- Docker + Docker Compose (optional but recommended for one-command startup).

## Quick Start

```bash
# 1) Clone repo & install prerequisites
git clone <repo>

# 2) Copy env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3) One-command dev stack (backend + frontend + live reload)
make dev
# or, manually:
#   make backend
#   make frontend
```

The frontend runs on <http://127.0.0.1:5173> and the API on <http://127.0.0.1:8000>.

### Backend Setup (manual)

```bash
cd backend
python -m pip install .[dev]  # requires Python 3.10+
python -m app.db.init_db      # seed roles & questions
uvicorn app.main:app --reload
```

### Frontend Setup (manual)

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Testing & Linting

```bash
# Frontend
npm run lint         # ESLint + Tailwind rules
npm run test         # Vitest + Testing Library
npm run build        # Type-check + production build

# Backend (requires Python >= 3.10)
python -m pytest
ruff check .         # static analysis
black .              # formatting
```

> **Note:** The repository was authored against Python 3.11. Running the backend on Python < 3.10 is not supported.

## Database & Seeding

- Seed data lives in `backend/app/seeds/seed_roles_and_questions.json`. To add new roles or questions, edit that file and rerun `python -m app.db.init_db` (idempotent).
- Alembic migrations are stored in `backend/alembic/versions`. Run `alembic upgrade head` for schema changes.

## Environment

| Variable              | Location           | Description                                            |
|-----------------------|--------------------|--------------------------------------------------------|
| `OPENAI_API_KEY`      | backend `.env`     | Optional. Enables full LLM evaluation via OpenAI SDK.  |
| `DATABASE_URL`        | backend `.env`     | Defaults to SQLite. Use `postgresql+psycopg://...`.     |
| `APP_ENV`             | backend `.env`     | `development` or `production`.                         |
| `VITE_API_BASE_URL`   | frontend `.env`    | Base URL for REST calls (default: local FastAPI).      |

Without an `OPENAI_API_KEY`, the evaluation service falls back to a deterministic heuristic so the app remains usable offline.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs:

1. Backend lint (ruff), format check (black), and pytest.
2. Frontend lint, vitest, and production build.

Pre-commit (`.pre-commit-config.yaml`) mirrors these checks locally (`pre-commit install` recommended).

## Roadmap

1. Speech-to-text integration (Whisper or similar).
2. Optional authentication to persist history across devices.
3. Analytics dashboard (progress charts, trending tiers).
4. Export session summary to PDF.

## Privacy & Ethics

- Interface prominently states: "Educational practice tool. No guarantee of hiring decisions. Feedback may be imperfect."
- Consent modal explains local storage usage and optional API key handling before first use.
- Ready tier wording ("Would you be hired?" prompt) is framed as a non-binding readiness signal.
- Question bank contains original, generic prompts (no proprietary interview content).

## Troubleshooting

- **Node 20 warning:** Vite 5 targets Node >=18.17. Warnings can appear on older Node 18 minors; upgrading to the latest LTS resolves them.
- **Backend install fails:** Ensure Python 3.10+ and up-to-date pip (`python -m pip install --upgrade pip`).
- **LLM errors:** Without an API key the evaluator logs a warning and falls back to heuristics. Supply a key to restore full AI feedback.

## Contributing

1. Fork & branch from `main`.
2. Run `pre-commit run --all-files` before pushing.
3. Open a PR with screenshots or recordings if the UI changes.
