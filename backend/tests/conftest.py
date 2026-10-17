import os

# Point the app at the test database before anything imports app.core.db.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://mm:mm@localhost:5432/misconceptmap_test"
)

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
