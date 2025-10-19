PYTHON ?= python

.PHONY: dev backend frontend install-backend install-frontend lint test seed fmt

install-backend:
	cd backend && $(PYTHON) -m pip install .[dev]

install-frontend:
	cd frontend && npm install

dev:
	docker compose up

backend:
	cd backend && uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

lint:
	cd backend && ruff check .
	npm run lint --prefix frontend

test:
	cd frontend && npm run test
	@echo "Backend tests require Python >= 3.10. Run \`$(PYTHON) -m pytest\` inside backend/ once available."

seed:
	cd backend && $(PYTHON) -m app.db.init_db

fmt:
	cd backend && black .
	npm run format --prefix frontend
