"""Practice sessions: serve questions, grade answers, update mastery and the review queue.

Every answer is handled in one transaction: the attempt row (append-only), the mastery cache
for each concept the question tests, and the student's review schedule for that question.
"""

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.router import plain_preview
from app.engine.bkt import BKT, params_for
from app.engine.scheduler import Schedule, after_right, after_wrong
from app.engine.selector import Candidate, choose
from app.models import (
    Attempt,
    BKTParams,
    Concept,
    ConceptPrereq,
    Mastery,
    Misconception,
    PracticeSession,
    Question,
    QuestionConcept,
    ReviewItem,
    SessionItem,
    Subject,
    User,
)
from app.practice.schemas import (
    AnswerIn,
    AnswerResult,
    MasteryChange,
    MisconceptionHit,
    OptionPublic,
    QuestionPublic,
    SessionIn,
    SessionItemOut,
    SessionOut,
)

PLANNED = {"questions", "review"}  # every item is fixed when the session starts


class PracticeError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def now() -> datetime:
    return datetime.now(UTC)


# ------------------------------------------------------------------ lookups


def _subject_id(db: Session, code: str | None) -> int | None:
    if code is None:
        return None
    sid = db.scalar(select(Subject.id).where(Subject.code == code))
    if sid is None:
        raise PracticeError(f"Unknown subject {code}", 404)
    return sid


def _concept_ids(db: Session, question_id: int) -> tuple[int | None, list[int]]:
    """(primary concept id, other concept ids) for a question."""
    rows = db.execute(
        select(QuestionConcept.concept_id, QuestionConcept.is_primary).where(
            QuestionConcept.question_id == question_id
        )
    ).all()
    primary = next((cid for cid, p in rows if p), None)
    others = sorted(cid for cid, p in rows if not p)
    return primary, others


def _bkt(db: Session, concept_id: int, qtype: str) -> BKT:
    row = db.get(BKTParams, concept_id)
    fitted = None
    if row and None not in (row.p_init, row.p_learn, row.p_slip, row.p_guess):
        fitted = BKT(row.p_init, row.p_learn, row.p_slip, row.p_guess)
    return params_for(qtype, fitted)


def mastery_map(db: Session, user_id: int) -> dict[int, float]:
    return dict(
        db.execute(
            select(Mastery.concept_id, Mastery.p_mastery).where(Mastery.user_id == user_id)
        ).all()
    )


def public_question(db: Session, q: Question) -> QuestionPublic:
    rows = db.execute(
        select(Concept.slug, QuestionConcept.is_primary, Subject.code)
        .join(Concept, Concept.id == QuestionConcept.concept_id)
        .join(Subject, Subject.id == Concept.subject_id)
        .where(QuestionConcept.question_id == q.id)
        .order_by(QuestionConcept.is_primary.desc(), Concept.slug)
    ).all()
    primary = next((r for r in rows if r.is_primary), rows[0] if rows else None)
    return QuestionPublic(
        id=q.id,
        qtype=q.qtype,
        subject=primary.code if primary else "",
        concept=primary.slug if primary else "",
        also_tests=[r.slug for r in rows if r is not primary],
        source=q.source,
        difficulty=q.difficulty,
        stem_md=q.stem_md,
        preview=plain_preview(q.stem_md, 160),
        options=[OptionPublic(label=o.label, text_md=o.text_md) for o in q.options],
    )


# ------------------------------------------------------------------ choosing questions


def _pick(db: Session, s: PracticeSession) -> tuple[int, str] | None:
    """Next question for an on-demand session, without saving anything."""
    served = select(SessionItem.question_id).where(SessionItem.session_id == s.id)
    query = (
        select(Question.id, QuestionConcept.concept_id)
        .join(QuestionConcept, QuestionConcept.question_id == Question.id)
        .join(Concept, Concept.id == QuestionConcept.concept_id)
        .where(Question.status == "approved", Question.id.not_in(served))
    )
    focus = db.get(Concept, s.concept_id) if s.mode == "concept" and s.concept_id else None
    if focus is not None:
        query = query.where(QuestionConcept.concept_id == focus.id)
    else:
        query = query.where(QuestionConcept.is_primary.is_(True))
        if s.subject_id is not None:
            query = query.where(Concept.subject_id == s.subject_id)
    rows = db.execute(query).all()
    if not rows:
        return None

    last = dict(
        db.execute(
            select(Attempt.question_id, func.max(Attempt.answered_at))
            .where(Attempt.user_id == s.user_id)
            .group_by(Attempt.question_id)
        ).all()
    )
    candidates = [
        Candidate(qid, cid, last[qid].timestamp() if qid in last else None) for qid, cid in rows
    ]
    names = dict(db.execute(select(Concept.id, Concept.name)).all())
    prereqs: dict[int, list[int]] = defaultdict(list)
    for cid, pid in db.execute(select(ConceptPrereq.concept_id, ConceptPrereq.prereq_id)):
        prereqs[cid].append(pid)

    picked = choose(mastery_map(db, s.user_id), names, prereqs, candidates)
    if picked and focus is not None:
        return picked[0], f"Practising {focus.name}"
    return picked


def _items(db: Session, session_id: int) -> list[SessionItem]:
    return list(
        db.scalars(
            select(SessionItem)
            .where(SessionItem.session_id == session_id)
            .order_by(SessionItem.position)
        )
    )


def _attempts(db: Session, session_id: int) -> dict[int, Attempt]:
    return {
        a.question_id: a
        for a in db.scalars(select(Attempt).where(Attempt.session_id == session_id))
    }


def serve_next(db: Session, s: PracticeSession) -> None:
    """Add the next question if the session is on-demand and the current one is answered."""
    if s.ended_at is not None or s.mode in PLANNED:
        return
    items = _items(db, s.id)
    answered = _attempts(db, s.id)
    if any(i.question_id not in answered for i in items) or len(items) >= (s.size or 0):
        return
    picked = _pick(db, s)
    if picked:
        db.add(
            SessionItem(
                session_id=s.id, position=len(items) + 1, question_id=picked[0], reason=picked[1]
            )
        )
        db.flush()


# ------------------------------------------------------------------ sessions


def create_session(db: Session, user: User, data: SessionIn) -> PracticeSession:
    subject_id = _subject_id(db, data.subject)
    s = PracticeSession(user_id=user.id, mode=data.mode, subject_id=subject_id, size=data.size)

    if data.mode == "questions":
        ids = list(dict.fromkeys(data.questions))
        found = set(
            db.scalars(
                select(Question.id).where(Question.id.in_(ids), Question.status == "approved")
            )
        )
        missing = [i for i in ids if i not in found]
        if missing:
            raise PracticeError(f"Question {missing[0]} is not available", 404)
        s.title = "Single question" if len(ids) == 1 else "Recommended set"
        s.size = len(ids)
        planned = [
            (qid, "You chose this question" if len(ids) == 1 else "Recommended for you")
            for qid in ids
        ]

    elif data.mode == "review":
        due = select(ReviewItem.question_id).where(
            ReviewItem.user_id == user.id, ReviewItem.due_at <= now()
        )
        if subject_id is not None:
            due = (
                due.join(QuestionConcept, QuestionConcept.question_id == ReviewItem.question_id)
                .join(Concept, Concept.id == QuestionConcept.concept_id)
                .where(QuestionConcept.is_primary.is_(True), Concept.subject_id == subject_id)
            )
        due = due.join(Question, Question.id == ReviewItem.question_id).where(
            Question.status == "approved"
        )
        ids = list(db.scalars(due.order_by(ReviewItem.due_at).limit(data.size)))
        if not ids:
            raise PracticeError("Nothing is due for review right now", 409)
        wrong = dict(
            db.execute(
                select(Attempt.question_id, func.count())
                .where(
                    Attempt.user_id == user.id,
                    Attempt.question_id.in_(ids),
                    Attempt.is_correct.is_(False),
                )
                .group_by(Attempt.question_id)
            ).all()
        )
        s.title, s.size = "Review", len(ids)
        planned = [(qid, f"Due for review · wrong {wrong.get(qid, 1)}×") for qid in ids]

    elif data.mode == "concept":
        concept = db.scalar(select(Concept).where(Concept.slug == data.concept))
        if concept is None:
            raise PracticeError(f"Unknown concept {data.concept}", 404)
        s.concept_id, s.title = concept.id, f"Concept practice · {concept.name}"
        planned = []
    else:
        s.title = f"Adaptive · {data.subject}" if data.subject else "Adaptive session"
        planned = []

    db.add(s)
    db.flush()
    for pos, (qid, reason) in enumerate(planned, start=1):
        db.add(SessionItem(session_id=s.id, position=pos, question_id=qid, reason=reason))
    db.flush()
    serve_next(db, s)
    if not _items(db, s.id):
        raise PracticeError("There are no approved questions to practise yet", 409)
    return s


def get_session(db: Session, user: User, session_id: int) -> PracticeSession:
    s = db.get(PracticeSession, session_id)
    if s is None or s.user_id != user.id:
        raise PracticeError("Session not found", 404)
    return s


def end_session(db: Session, s: PracticeSession) -> None:
    if s.ended_at is None:
        s.ended_at = now()
        db.flush()


# ------------------------------------------------------------------ answering


def _grade(q: Question, data: AnswerIn) -> tuple[bool, list[str]]:
    labels = {o.label for o in q.options}
    chosen = sorted(set(data.chosen))
    if q.qtype == "NAT":
        if data.nat_value is None:
            raise PracticeError("Enter a numerical answer")
        lo, hi = q.nat_answer_min, q.nat_answer_max
        if lo is None or hi is None:
            raise PracticeError("This question has no answer range", 409)
        return lo <= data.nat_value <= hi, []
    if not chosen:
        raise PracticeError("Choose an option")
    if any(c not in labels for c in chosen):
        raise PracticeError("Unknown option")
    if q.qtype == "MCQ" and len(chosen) != 1:
        raise PracticeError("Choose exactly one option")
    correct = sorted(o.label for o in q.options if o.is_correct)
    return chosen == correct, chosen


def _hits(db: Session, q: Question, chosen: list[str]) -> list[MisconceptionHit]:
    hits = []
    for o in q.options:
        if o.label in chosen and not o.is_correct and o.misconception_id:
            m = db.get(Misconception, o.misconception_id)
            if m:
                hits.append(
                    MisconceptionHit(
                        label=o.label,
                        id=m.id,
                        slug=m.slug,
                        title=m.title,
                        explanation=m.explanation,
                        example=m.example,
                    )
                )
    return hits


def _schedule(
    db: Session, user_id: int, question_id: int, correct: bool, at: datetime
) -> datetime | None:
    item = db.get(ReviewItem, (user_id, question_id))
    current = (
        Schedule(item.interval_days, item.ease, item.repetitions, item.due_at) if item else None
    )
    if not correct:
        nxt = after_wrong(at, current)
    elif current is None:
        return None
    else:
        nxt = after_right(at, current)
        if nxt is None:
            db.delete(item)
            return None
    if item is None:
        item = ReviewItem(user_id=user_id, question_id=question_id)
        db.add(item)
    item.due_at, item.interval_days, item.ease, item.repetitions = (
        nxt.due_at,
        nxt.interval_days,
        nxt.ease,
        nxt.repetitions,
    )
    return nxt.due_at


def answer(db: Session, s: PracticeSession, data: AnswerIn) -> AnswerResult:
    if s.ended_at is not None:
        raise PracticeError("This session has ended", 409)
    item = db.scalar(
        select(SessionItem).where(
            SessionItem.session_id == s.id, SessionItem.question_id == data.question_id
        )
    )
    if item is None:
        raise PracticeError("That question is not part of this session", 404)
    if data.question_id in _attempts(db, s.id):
        raise PracticeError("Already answered", 409)
    q = db.get(Question, data.question_id)
    correct, chosen = _grade(q, data)
    at = now()

    primary, others = _concept_ids(db, q.id)
    changes: list[MasteryChange] = []
    slugs = dict(db.execute(select(Concept.id, Concept.slug)).all())
    for cid in [c for c in [primary, *others] if c is not None]:
        bkt = _bkt(db, cid, q.qtype)
        row = db.get(Mastery, (s.user_id, cid))
        before = row.p_mastery if row else bkt.p_init
        after = bkt.update(before, correct)
        if row is None:
            row = Mastery(user_id=s.user_id, concept_id=cid, p_mastery=after, n_attempts=1)
            db.add(row)
        else:
            row.p_mastery, row.n_attempts = after, row.n_attempts + 1
        row.updated_at = at
        changes.append(MasteryChange(concept=slugs[cid], before=before, after=after))

    chosen_ids = [o.id for o in q.options if o.label in chosen]
    db.add(
        Attempt(
            user_id=s.user_id,
            session_id=s.id,
            question_id=q.id,
            chosen_option_id=chosen_ids[0] if len(chosen_ids) == 1 else None,
            chosen_labels=",".join(chosen) or None,
            nat_value=data.nat_value if q.qtype == "NAT" else None,
            is_correct=correct,
            time_taken_ms=data.time_taken_ms,
            confidence=data.confidence,
            mastery_before=changes[0].before if changes else None,
            mastery_after=changes[0].after if changes else None,
            answered_at=at,
        )
    )
    due = _schedule(db, s.user_id, q.id, correct, at)
    db.flush()
    return _result(db, q, correct, chosen, data.nat_value, changes, due, data.time_taken_ms)


def _result(db, q, correct, chosen, nat_value, changes, due, time_ms) -> AnswerResult:
    return AnswerResult(
        question_id=q.id,
        correct=correct,
        chosen=chosen,
        nat_value=nat_value if q.qtype == "NAT" else None,
        correct_labels=sorted(o.label for o in q.options if o.is_correct),
        nat_answer_min=q.nat_answer_min,
        nat_answer_max=q.nat_answer_max,
        explanation_md=q.explanation_md,
        misconceptions=_hits(db, q, chosen),
        mastery=changes,
        review_due_at=due,
        time_taken_ms=time_ms,
    )


def _result_from_attempt(db: Session, q: Question, a: Attempt) -> AnswerResult:
    primary, _ = _concept_ids(db, q.id)
    changes = []
    if primary is not None and a.mastery_before is not None and a.mastery_after is not None:
        slug = db.scalar(select(Concept.slug).where(Concept.id == primary))
        changes = [MasteryChange(concept=slug, before=a.mastery_before, after=a.mastery_after)]
    item = db.get(ReviewItem, (a.user_id, q.id))
    chosen = a.chosen_labels.split(",") if a.chosen_labels else []
    nat = Decimal(a.nat_value) if a.nat_value is not None else None
    return _result(
        db, q, a.is_correct, chosen, nat, changes, item.due_at if item else None, a.time_taken_ms
    )


def session_out(db: Session, s: PracticeSession) -> SessionOut:
    items = _items(db, s.id)
    attempts = _attempts(db, s.id)
    out = []
    for it in items:
        q = db.get(Question, it.question_id)
        a = attempts.get(q.id)
        out.append(
            SessionItemOut(
                position=it.position,
                reason=it.reason,
                question=public_question(db, q),
                result=_result_from_attempt(db, q, a) if a else None,
            )
        )
    all_answered = all(i.result is not None for i in out)
    done = s.ended_at is not None or (
        all_answered and (s.mode in PLANNED or len(out) >= (s.size or 0) or _pick(db, s) is None)
    )
    return SessionOut(
        id=s.id,
        mode=s.mode or "adaptive",
        title=s.title or "Practice session",
        size=s.size if s.mode in PLANNED else max(s.size or 0, len(out)),
        started_at=s.started_at,
        ended_at=s.ended_at,
        done=done,
        items=out,
    )
