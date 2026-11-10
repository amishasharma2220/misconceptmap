import os

# Point the app at the test database before anything imports app.core.db.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://mm:mm@localhost:5432/misconceptmap_test"
)
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-0000"

import pytest  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.db import Base, engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    """A session inside a transaction that is rolled back after each test."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()


# ---------------------------------------------------------------- API helpers

from pathlib import Path  # noqa: E402

import yaml  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.content.loader import load_subject, parse_file  # noqa: E402
from app.content.questions_loader import load as load_questions  # noqa: E402
from app.core.db import get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Question, User  # noqa: E402
from app.tagging.llm import get_llm_client  # noqa: E402

DSA_YAML = os.path.join(os.path.dirname(__file__), "..", "..", "content", "concepts", "dsa.yaml")


class FakeLLM:
    """Returns canned replies in order; records prompts so tests can inspect them."""

    model = "fake-llm"

    def __init__(self, *replies: str):
        self.replies = list(replies)
        self.prompts: list[str] = []

    def complete_json(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self.replies.pop(0)


@pytest.fixture
def llm_holder():
    return {"client": None}


@pytest.fixture
def client(db, llm_holder):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_llm_client] = lambda: llm_holder["client"]
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _make_user(db, email: str, role: str) -> dict:
    user = User(email=email, password_hash=hash_password("password123"), role=role)
    db.add(user)
    db.flush()
    return {"Authorization": f"Bearer {create_access_token(user.id, role)}"}


@pytest.fixture
def admin_headers(db):
    return _make_user(db, "admin@example.com", "admin")


@pytest.fixture
def student_headers(db):
    return _make_user(db, "student@example.com", "student")


@pytest.fixture
def dsa(db):
    """Load the real DSA concept graph; return {slug: concept_id}."""
    subject, specs = parse_file(__import__("pathlib").Path(DSA_YAML))
    load_subject(db, subject, specs)
    db.flush()
    from sqlalchemy import select

    from app.models import Concept

    return dict(db.execute(select(Concept.slug, Concept.id)).all())


QUESTIONS_YAML = Path(__file__).resolve().parents[2] / "content" / "questions" / "dsa.yaml"


@pytest.fixture
def bank(db, dsa):
    """The real starter question bank; returns {key: question_id}."""
    load_questions(db, yaml.safe_load(QUESTIONS_YAML.read_text()))
    db.flush()
    return dict(db.execute(select(Question.import_key, Question.id)).all())
