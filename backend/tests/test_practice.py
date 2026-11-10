import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import yaml
from sqlalchemy import select

from app.content.questions_loader import load
from app.content.service import ContentError
from app.engine.bkt import DEFAULT
from app.models import Attempt, Mastery, Question, ReviewItem, User

QUESTIONS_YAML = (
    Path(os.path.dirname(__file__)) / ".." / ".." / "content" / "questions" / "dsa.yaml"
)


def correct_label(db, qid):
    q = db.get(Question, qid)
    return next(o.label for o in q.options if o.is_correct)


def wrong_label(db, qid, with_misconception=True):
    q = db.get(Question, qid)
    return next(
        o.label
        for o in q.options
        if not o.is_correct and (o.misconception_id is not None) == with_misconception
    )


# ------------------------------------------------------------------ importer


def test_bank_imports_approved_and_is_idempotent(db, bank):
    assert len(bank) == 13
    statuses = set(db.scalars(select(Question.status)))
    assert statuses == {"approved"}
    again = load(db, yaml.safe_load(QUESTIONS_YAML.read_text()))
    assert again["created"] == 0 and again["updated"] == 13
    assert (
        db.scalar(select(Question.id).where(Question.import_key == "dsa-ll-001"))
        == bank["dsa-ll-001"]
    )


def test_importer_rejects_bad_questions(db, dsa):
    bad = {
        "questions": [
            {
                "key": "x",
                "concept": "hashing",
                "stem": "Which slot?",
                "explanation": "Because.",
                "options": [{"text": "a", "correct": True}, {"text": "b", "correct": True}],
            }
        ]
    }
    with pytest.raises(ContentError, match="exactly 1 correct"):
        load(db, bad)
    bad["questions"][0]["concept"] = "no-such-concept"
    with pytest.raises(ContentError, match="unknown concept"):
        load(db, bad)


# ------------------------------------------------------------------ sessions


def test_session_requires_questions(client, student_headers, dsa):
    r = client.post("/sessions", json={}, headers=student_headers)
    assert r.status_code == 409


def test_adaptive_session_hides_answers_and_starts_at_a_root(client, student_headers, bank):
    r = client.post("/sessions", json={"size": 3}, headers=student_headers)
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["title"] == "Adaptive session" and not s["done"]
    [item] = s["items"]
    q = item["question"]
    assert set(q["options"][0]) == {"label", "text_md"}  # no correct flag, no misconception
    # a brand-new student is pointed at a concept with no prerequisites
    assert q["concept"] in {"asymptotic-notation", "arrays-pointers"}
    assert item["reason"].startswith("New concept")


def test_answer_updates_mastery_review_and_misconceptions(client, db, student_headers, bank):
    s = client.post("/sessions", json={"size": 2}, headers=student_headers).json()
    qid = s["items"][0]["question"]["id"]
    label = wrong_label(db, qid)

    r = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": [label], "time_taken_ms": 42000},
        headers=student_headers,
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["correct"] is False
    assert res["correct_labels"] == [correct_label(db, qid)]
    assert res["misconceptions"][0]["label"] == label
    m = res["mastery"][0]
    assert m["before"] == pytest.approx(0.2)
    assert m["after"] == pytest.approx(DEFAULT.update(0.2, False))
    assert res["review_due_at"] is not None

    # stored: append-only attempt, mastery cache, review item
    a = db.scalar(select(Attempt).where(Attempt.question_id == qid))
    assert a.chosen_labels == label and a.time_taken_ms == 42000 and a.session_id == s["id"]
    assert db.scalar(select(Mastery.n_attempts)) == 1
    assert db.scalar(select(ReviewItem.interval_days).where(ReviewItem.question_id == qid)) == 1

    # cannot answer twice
    again = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": [label]},
        headers=student_headers,
    )
    assert again.status_code == 409


def test_next_serves_one_at_a_time_until_size(client, db, student_headers, bank):
    s = client.post("/sessions", json={"size": 2}, headers=student_headers).json()
    sid = s["id"]
    # next before answering returns the same single item
    assert len(client.post(f"/sessions/{sid}/next", headers=student_headers).json()["items"]) == 1

    seen = []
    for _ in range(2):
        cur = client.get(f"/sessions/{sid}", headers=student_headers).json()["items"][-1]
        qid = cur["question"]["id"]
        seen.append(qid)
        client.post(
            f"/sessions/{sid}/answer",
            json={"question_id": qid, "chosen": [correct_label(db, qid)]},
            headers=student_headers,
        )
        out = client.post(f"/sessions/{sid}/next", headers=student_headers).json()
    assert len(set(seen)) == 2
    assert out["done"] is True and len(out["items"]) == 2
    assert all(i["result"]["correct"] for i in out["items"])

    ended = client.post(f"/sessions/{sid}/end", headers=student_headers).json()
    assert ended["ended_at"] is not None
    r = client.post(
        f"/sessions/{sid}/answer",
        json={"question_id": seen[0], "chosen": ["A"]},
        headers=student_headers,
    )
    assert r.status_code == 409


def test_weak_prerequisite_steers_the_next_question(client, db, student_headers, bank, dsa):
    user_id = db.scalar(select(User.id).where(User.email == "student@example.com"))
    for slug, p in [
        ("master-theorem", 0.1),
        ("recurrence-relations", 0.3),
        ("asymptotic-notation", 0.9),
        ("arrays-pointers", 0.9),
    ]:
        db.add(Mastery(user_id=user_id, concept_id=dsa[slug], p_mastery=p, n_attempts=1))
    db.flush()
    s = client.post("/sessions", json={"size": 1}, headers=student_headers).json()
    item = s["items"][0]
    assert item["question"]["id"] == bank["dsa-rec-001"]
    assert item["reason"] == "Weak prerequisite of Master theorem"


def test_questions_and_concept_modes(client, db, student_headers, bank):
    ids = [bank["dsa-hash-001"], bank["dsa-ll-001"]]
    s = client.post(
        "/sessions", json={"mode": "questions", "questions": ids}, headers=student_headers
    ).json()
    assert [i["question"]["id"] for i in s["items"]] == ids
    assert s["title"] == "Recommended set" and s["size"] == 2

    s = client.post(
        "/sessions", json={"mode": "concept", "concept": "master-theorem"}, headers=student_headers
    ).json()
    assert s["title"] == "Concept practice · Master theorem"
    assert s["items"][0]["question"]["id"] == bank["dsa-mt-001"]
    assert s["items"][0]["reason"] == "Practising Master theorem"

    r = client.post(
        "/sessions", json={"mode": "questions", "questions": [999999]}, headers=student_headers
    )
    assert r.status_code == 404


def test_review_session_uses_due_items(client, db, student_headers, bank):
    r = client.post("/sessions", json={"mode": "review"}, headers=student_headers)
    assert r.status_code == 409  # nothing due

    qid = bank["dsa-stk-001"]
    s = client.post(
        "/sessions", json={"mode": "questions", "questions": [qid]}, headers=student_headers
    ).json()
    client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": [wrong_label(db, qid)]},
        headers=student_headers,
    )
    item = db.scalar(select(ReviewItem).where(ReviewItem.question_id == qid))
    item.due_at = datetime.now(UTC) - timedelta(minutes=1)
    db.flush()

    s = client.post("/sessions", json={"mode": "review"}, headers=student_headers).json()
    assert [i["question"]["id"] for i in s["items"]] == [qid]
    assert s["items"][0]["reason"] == "Due for review · wrong 1×"
    res = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": [correct_label(db, qid)]},
        headers=student_headers,
    ).json()
    assert res["correct"] and res["review_due_at"] is not None
    db.refresh(item)
    assert item.repetitions == 1 and item.interval_days == 3


def test_sessions_are_private(client, db, student_headers, admin_headers, bank):
    s = client.post("/sessions", json={}, headers=student_headers).json()
    assert client.get(f"/sessions/{s['id']}", headers=admin_headers).status_code == 404


def test_answer_validation(client, db, student_headers, bank):
    s = client.post("/sessions", json={}, headers=student_headers).json()
    qid = s["items"][0]["question"]["id"]
    other = next(v for v in bank.values() if v != qid)
    for body, status in [
        ({"question_id": qid, "chosen": []}, 400),
        ({"question_id": qid, "chosen": ["A", "B"]}, 400),
        ({"question_id": qid, "chosen": ["Z"]}, 400),
        ({"question_id": other, "chosen": ["A"]}, 404),
    ]:
        r = client.post(f"/sessions/{s['id']}/answer", json=body, headers=student_headers)
        assert r.status_code == status, (body, r.text)


# ------------------------------------------------------------------ snapshot


def test_snapshot_for_new_student_is_empty_but_complete(client, student_headers, bank):
    r = client.get("/me/snapshot?tz=330", headers=student_headers)
    assert r.status_code == 200, r.text
    snap = r.json()
    assert snap["totals"] == {
        "answered": 0,
        "answeredThisWeek": 0,
        "streakDays": 0,
        "avgSecondsPerQuestion": None,
    }
    assert len(snap["daily"]) == 30 and all(d["accuracy"] is None for d in snap["daily"])
    assert all(c["mastery"] is None and c["trend"] == [] for c in snap["concepts"])
    assert len(snap["questions"]) == 13
    assert "options" not in snap["questions"][0]
    assert snap["gateDate"]
    by_slug = {c["slug"]: c for c in snap["concepts"]}
    assert by_slug["master-theorem"]["prereqs"] == ["recurrence-relations"]


def test_snapshot_reflects_practice(client, db, student_headers, bank):
    qid = bank["dsa-stk-001"]
    s = client.post(
        "/sessions", json={"mode": "questions", "questions": [qid]}, headers=student_headers
    ).json()
    label = wrong_label(db, qid)
    client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": [label], "time_taken_ms": 75000},
        headers=student_headers,
    )
    snap = client.get("/me/snapshot", headers=student_headers).json()
    c = next(c for c in snap["concepts"] if c["slug"] == "stacks-queues")
    assert c["attempts"] == 1 and c["accuracy"] == 0 and c["lastPractisedDays"] == 0
    assert c["mastery"] == pytest.approx(DEFAULT.update(0.2, False))
    assert len(c["trend"]) == 7 and c["trend"][-1] == pytest.approx(c["mastery"], abs=1e-4)
    hit = [m for m in snap["misconceptions"] if m["hits"]]
    assert len(hit) == 1 and hit[0]["concept"] == "stacks-queues" and hit[0]["lastSeenDays"] == 0
    assert snap["review"][0]["questionId"] == qid and snap["review"][0]["timesWrong"] == 1
    assert snap["sessions"][0]["questions"] == 1 and snap["sessions"][0]["correct"] == 0
    assert snap["totals"]["answered"] == 1 and snap["totals"]["streakDays"] == 1
    assert snap["totals"]["avgSecondsPerQuestion"] == 75
    assert snap["daily"][-1] == {"date": snap["daily"][-1]["date"], "questions": 1, "accuracy": 0}
    assert {b["bucket"]: b["questions"] for b in snap["timeBuckets"]}["1–2 min"] == 1
    assert next(d for d in snap["byDifficulty"] if d["level"] == "Level 2")["questions"] == 1


def test_previews_are_readable_text():
    from app.content.router import plain_preview

    assert plain_preview(r"Let $f(n) = 2^{n+1}$ and $T(n) = \dfrac{n}{\log n}$, $n \ge 1$") == (
        "Let f(n) = 2^(n+1) and T(n) = n/(log n), n ≥ 1"
    )
    md = "Evaluate `2 3 4 * + 5 -` for **n > 1**"
    assert plain_preview(md) == "Evaluate 2 3 4 * + 5 - for n > 1"
    assert plain_preview("What prints?\n\n```c\nint x;\n```") == "What prints? [code]"
