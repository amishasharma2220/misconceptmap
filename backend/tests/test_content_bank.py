"""The real content files: they load, and the question types students meet all grade correctly."""

from collections import Counter

import yaml
from sqlalchemy import func, select

from app.models import Misconception, Option, Question, Subject
from tests.conftest import CONTENT, SUBJECTS


def test_every_subject_loads_with_approved_questions(db, all_content):
    codes = set(db.scalars(select(Subject.code)))
    assert codes == {"DSA", "OS", "DBMS"}
    assert db.scalar(select(func.count()).select_from(Question)) == len(all_content) == 41
    assert set(db.scalars(select(Question.status))) == {"approved"}


def test_every_wrong_option_misconception_belongs_to_a_tested_subject(db, all_content):
    # misconceptions referenced by options all exist and point at a real concept
    mids = set(
        db.scalars(select(Option.misconception_id).where(Option.misconception_id.is_not(None)))
    )
    assert mids
    rows = db.execute(select(Misconception.id, Misconception.concept_id)).all()
    assert mids <= {m for m, _ in rows}
    assert all(c is not None for _, c in rows)


def test_question_keys_are_unique_across_files():
    keys = Counter()
    for s in SUBJECTS:
        data = yaml.safe_load((CONTENT / "questions" / f"{s}.yaml").read_text())
        keys.update(q["key"] for q in data["questions"])
    assert [k for k, n in keys.items() if n > 1] == []


def start(client, headers, qid):
    s = client.post("/sessions", json={"mode": "questions", "questions": [qid]}, headers=headers)
    assert s.status_code == 201, s.text
    return s.json()


def test_numerical_answer_question(client, student_headers, all_content):
    qid = all_content["os-paging-002"]
    s = start(client, student_headers, qid)
    item = s["items"][0]["question"]
    assert item["qtype"] == "NAT" and item["options"] == []

    r = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "nat_value": "4"},
        headers=student_headers,
    ).json()
    assert r["correct"] is False and r["nat_answer_min"] == "2" and r["review_due_at"]

    s = start(client, student_headers, qid)
    r = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "nat_value": "2.0"},
        headers=student_headers,
    ).json()
    assert r["correct"] is True

    s = start(client, student_headers, qid)
    r = client.post(
        f"/sessions/{s['id']}/answer",
        json={"question_id": qid, "chosen": ["A"]},
        headers=student_headers,
    )
    assert r.status_code == 400  # a NAT answer needs a number


def test_multiple_select_question_needs_the_exact_set(client, student_headers, all_content):
    qid = all_content["dbms-2pl-002"]  # correct: A, C, D; B is the deadlock misconception
    cases = [
        (["A", "C", "D"], True, []),
        (["A", "C"], False, []),  # incomplete
        (["A", "B", "C", "D"], False, ["B"]),  # includes a wrong option
    ]
    for chosen, correct, mis_labels in cases:
        s = start(client, student_headers, qid)
        assert s["items"][0]["question"]["qtype"] == "MSQ"
        r = client.post(
            f"/sessions/{s['id']}/answer",
            json={"question_id": qid, "chosen": chosen},
            headers=student_headers,
        ).json()
        assert r["correct"] is correct, chosen
        assert r["correct_labels"] == ["A", "C", "D"]
        assert [m["label"] for m in r["misconceptions"]] == mis_labels


def test_adaptive_session_can_be_limited_to_a_subject(client, student_headers, all_content):
    for code in ["OS", "DBMS"]:
        s = client.post(
            "/sessions", json={"subject": code, "size": 3}, headers=student_headers
        ).json()
        assert s["items"][0]["question"]["subject"] == code


def test_snapshot_lists_all_three_subjects(client, student_headers, all_content):
    snap = client.get("/me/snapshot", headers=student_headers).json()
    assert [s["code"] for s in snap["subjects"]] == ["DSA", "OS", "DBMS"]
    assert {q["subject"] for q in snap["questions"]} == {"DSA", "OS", "DBMS"}
