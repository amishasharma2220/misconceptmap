# MisconceptMap

GATE CS practice that diagnoses **why** you got a question wrong. Every wrong option is tagged with a named misconception, a knowledge-tracing model estimates mastery per concept, and the next question targets your weakest prerequisite.

> Status: **Week 1 — foundations.** Database schema, concept-graph loader, API and frontend shells, CI. Practice loop arrives in week 3.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Python, FastAPI, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 16 |
| ML (later) | BKT (own implementation + pyBKT), DKT via pyKT |
| Tooling | Docker Compose, pytest, Vitest, ruff, GitHub Actions |

## Run it locally

Needs Docker, Python 3.11+ and Node 20+.

```bash
# 1. Database (Postgres on :5432, Adminer UI on :8080)
docker compose up -d

# 2. Backend (http://localhost:8000, docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.content.loader ../content/concepts/dsa.yaml
uvicorn app.main:app --reload

# 3. Frontend (http://localhost:5173)
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

The home page shows a green badge when the frontend can reach the API and database.

### Tests

```bash
docker compose exec db createdb -U mm misconceptmap_test   # once
cd backend && pytest -q        # graph validation, loader, /health
cd frontend && npm test        # UI tests
```

## Content

Concept graphs live in `content/concepts/*.yaml` — one file per subject, each concept with its prerequisites. The loader validates the graph (no duplicates, no unknown prerequisites, no cycles) before writing anything, and is safe to re-run after edits.

## Layout

```
backend/   FastAPI app, models, Alembic migrations, tests
frontend/  React app
content/   concept graphs (and later, approved questions)
ml/        knowledge-tracing experiments
```
