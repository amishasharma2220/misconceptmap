from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.content.graph import ConceptGraphError, ConceptSpec
from app.content.loader import load_subject, parse_file
from app.core.db import get_db
from app.main import app
from app.models import Concept, ConceptPrereq

DSA = Path(__file__).resolve().parents[2] / "content" / "concepts" / "dsa.yaml"


def test_loader_inserts_concepts_and_edges(db):
    subject, specs = parse_file(DSA)
    report = load_subject(db, subject, specs)
    db.flush()

    assert report["created"] == len(specs)
    assert db.scalar(select(func.count()).select_from(Concept)) == len(specs)
    expected_edges = sum(len(s.prereqs) for s in specs)
    assert db.scalar(select(func.count()).select_from(ConceptPrereq)) == expected_edges


def test_loader_is_idempotent(db):
    subject, specs = parse_file(DSA)
    load_subject(db, subject, specs)
    report = load_subject(db, subject, specs)
    db.flush()

    assert report["created"] == 0
    assert report["updated"] == len(specs)
    assert db.scalar(select(func.count()).select_from(Concept)) == len(specs)


def test_loader_rejects_cycle_before_writing(db):
    bad = [
        ConceptSpec(slug="x", name="x", prereqs=["y"]),
        ConceptSpec(slug="y", name="y", prereqs=["x"]),
    ]
    with pytest.raises(ConceptGraphError, match="cycle"):
        load_subject(db, {"code": "BAD", "name": "Bad"}, bad)
    assert db.scalar(select(func.count()).select_from(Concept)) == 0


def test_health_endpoint(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        r = TestClient(app).get("/health")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}
