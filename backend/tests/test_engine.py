from datetime import UTC, datetime

import pytest

from app.engine.bkt import BKT, DEFAULT, NAT, params_for
from app.engine.scheduler import Schedule, after_right, after_wrong
from app.engine.selector import Candidate, choose

# ------------------------------------------------------------------ BKT


def test_bkt_matches_hand_worked_values():
    assert DEFAULT.update(0.2, True) == pytest.approx(0.5526, abs=1e-4)
    assert DEFAULT.update(0.2, False) == pytest.approx(0.1774, abs=1e-4)


@pytest.mark.parametrize("p", [0.01, 0.2, 0.5, 0.8, 0.99])
def test_bkt_direction_and_bounds(p):
    up, down = DEFAULT.update(p, True), DEFAULT.update(p, False)
    assert 0 < down <= up <= 0.99
    assert up >= p or p >= 0.99


def test_nat_questions_trust_correct_answers_more():
    assert NAT.update(0.2, True) > DEFAULT.update(0.2, True)
    assert params_for("NAT") is NAT and params_for("MCQ") is DEFAULT
    fitted = BKT(p_learn=0.3)
    assert params_for("MCQ", fitted) is fitted


def test_predicted_correctness():
    assert DEFAULT.p_correct(1.0) == pytest.approx(0.9)
    assert DEFAULT.p_correct(0.0) == pytest.approx(0.25)


# ------------------------------------------------------------------ scheduler

NOW = datetime(2026, 11, 10, 9, 0, tzinfo=UTC)


def test_wrong_answer_is_due_tomorrow_and_lowers_ease():
    s = after_wrong(NOW, None)
    assert s.interval_days == 1 and s.repetitions == 0 and s.ease == pytest.approx(2.3)
    assert (s.due_at - NOW).days == 1
    assert after_wrong(NOW, Schedule(1, 1.35, 2, NOW)).ease == 1.3  # floor


def test_right_answers_grow_the_interval_then_graduate():
    s = after_wrong(NOW, None)
    s1 = after_right(NOW, s)
    assert s1 and s1.interval_days == 3 and s1.repetitions == 1
    s2 = after_right(NOW, s1)
    assert s2 and s2.interval_days == pytest.approx(3 * s1.ease)
    s3 = after_right(NOW, s2)
    s4 = after_right(NOW, s3) if s3 else None
    assert s3 is None or s4 is None  # leaves the queue after enough spaced successes


# ------------------------------------------------------------------ selector

NAMES = {1: "Recurrences", 2: "Master theorem", 3: "Merge sort", 4: "Arrays"}
PREREQS = {2: [1], 3: [1, 4], 1: [], 4: []}


def cands(*pairs, attempted=None):
    attempted = attempted or {}
    return [Candidate(q, c, attempted.get(q)) for q, c in pairs]


def test_new_student_starts_at_a_root_concept():
    qid, reason = choose({}, NAMES, PREREQS, cands((10, 2), (11, 1), (12, 3)))
    assert qid == 11 and reason == "New concept: Recurrences"


def test_weak_prerequisite_is_practised_first():
    mastery = {2: 0.2, 1: 0.45, 3: 0.8, 4: 0.9}
    qid, reason = choose(mastery, NAMES, PREREQS, cands((10, 2), (11, 1), (12, 3)))
    assert qid == 11 and reason == "Weak prerequisite of Master theorem"


def test_ready_prerequisites_let_the_weak_concept_through():
    mastery = {2: 0.2, 1: 0.7}
    qid, reason = choose(mastery, NAMES, PREREQS, cands((10, 2), (11, 1)))
    assert qid == 10 and reason == "Weakest concept: Master theorem"


def test_prefers_unseen_then_least_recent_question():
    pool = cands((20, 1), (21, 1), (22, 1), attempted={20: 100.0, 21: 50.0})
    assert choose({1: 0.3}, NAMES, PREREQS, pool)[0] == 22
    pool = cands((20, 1), (21, 1), attempted={20: 100.0, 21: 50.0})
    assert choose({1: 0.3}, NAMES, PREREQS, pool)[0] == 21


def test_mastered_concepts_are_skipped_unless_nothing_else_is_left():
    assert choose({1: 0.97, 4: 0.5}, NAMES, PREREQS, cands((11, 1), (13, 4)))[0] == 13
    assert choose({1: 0.97}, NAMES, PREREQS, cands((11, 1)))[0] == 11


def test_no_candidates():
    assert choose({}, NAMES, PREREQS, []) is None
