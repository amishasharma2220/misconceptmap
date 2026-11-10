# MisconceptMap

GATE CS practice that diagnoses **why** you got a question wrong. Every wrong option is tagged with a named misconception, a knowledge-tracing model estimates mastery per concept, and the next question targets your weakest prerequisite.

> Status: **Week 2 + frontend.** Accounts and admin role, question editor with LLM-drafted misconception tags, and the full student frontend: landing site, dashboard, three-pane practice, review queue, analytics, concept map and an AI study coach panel.
>
> The student screens currently run on sample data (`frontend/src/data/sample.ts`) and a sample coach (`frontend/src/coach/sampleCoach.ts`). Both are isolated behind one hook each, so wiring them to the backend in week 3 changes only those files.

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
python -m app.content.questions_loader ../content/questions/dsa.yaml
uvicorn app.main:app --reload

# 3. Frontend (http://localhost:5173)
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

The home page shows a green badge when the frontend can reach the API and database.

### Become an admin

1. Create an account in the app (`/signup`).
2. In `backend/`, run `python -m app.auth.make_admin you@example.com`.
3. Sign out and back in. **Manage questions** now appears.

### Turn on AI tag drafting (optional)

Get a free key at <https://aistudio.google.com/apikey>, put it in `backend/.env` as `LLM_API_KEY=...`, and restart the backend. Without a key everything works except the **Draft tags** button. The model only drafts: nothing reaches students until you approve the question, and each approval records whether the draft was accepted unchanged.

### Tests

```bash
docker compose exec db createdb -U mm misconceptmap_test   # once
cd backend && pytest -q        # auth, content, tagging, engine, practice API, snapshot
cd frontend && npm test        # UI tests
```

## Content

Concept graphs live in `content/concepts/*.yaml` — one file per subject, each concept with its prerequisites. The loader validates the graph (no duplicates, no unknown prerequisites, no cycles) before writing anything, and is safe to re-run after edits.

Starter questions live in `content/questions/*.yaml`, each wrong option linked to the misconception it reveals. The importer runs every question through the same checks as the admin editor, approves it, and updates in place when re-run (matched by each question's `key`). Questions you write in the admin editor are never touched by it.

## How practice works

- **Choosing questions** (`backend/app/engine/selector.py`): take the weakest concept that still has unseen questions; if one of its prerequisites is below 60% and has questions, practise that prerequisite first. Every question shows the reason it was picked.
- **Mastery** (`engine/bkt.py`): Bayesian Knowledge Tracing per concept, updated on every answer for every concept the question tests. Numerical questions use a lower guess rate.
- **Review queue** (`engine/scheduler.py`): a wrong answer comes back in 1 day; correct reviews push it out by a growing interval until it leaves the queue.
- **Dashboard data** (`GET /me/snapshot`): computed from the append-only attempt log, with mastery history rebuilt by replaying attempts.

## Layout

```
backend/   FastAPI app, models, Alembic migrations, tests
frontend/  React app
content/   concept graphs and starter questions
ml/        knowledge-tracing experiments
```
