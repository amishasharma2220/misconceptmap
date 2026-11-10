"""GET /me/snapshot: everything the student screens need, computed from the attempt log.

Mastery history is rebuilt by replaying the student's attempts through BKT, so the trend
lines always agree with the mastery cache and nothing extra has to be stored.
"""

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content.router import plain_preview
from app.core.config import get_settings
from app.models import (
    Attempt,
    Concept,
    ConceptPrereq,
    Mastery,
    Misconception,
    Option,
    PracticeSession,
    Question,
    QuestionConcept,
    ReviewItem,
    Subject,
    User,
)
from app.practice.service import _bkt

MODE_LABEL = {"adaptive": "Adaptive", "review": "Review", "concept": "Concept", "questions": "Set"}
TIME_BUCKETS = [
    ("< 30s", 30),
    ("30–60s", 60),
    ("1–2 min", 120),
    ("2–3 min", 180),
    ("3–5 min", 300),
    ("> 5 min", None),
]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SubjectS(Camel):
    code: str
    name: str
    short: str


class ConceptS(Camel):
    slug: str
    name: str
    subject: str
    description: str
    prereqs: list[str]
    mastery: float | None
    attempts: int
    accuracy: float | None
    last_practised_days: int | None
    trend: list[float]


class MisconceptionS(Camel):
    id: int
    slug: str
    title: str
    explanation: str
    example: str | None
    concept: str
    hits: int
    last_seen_days: int | None


class QuestionS(Camel):
    id: int
    subject: str
    concept: str
    also_tests: list[str]
    difficulty: int | None
    source: str | None
    stem: str


class SessionS(Camel):
    id: int
    date: str
    subject: str
    mode: str
    title: str
    questions: int
    correct: int
    minutes: int
    mastery_delta: float


class DailyS(Camel):
    date: str
    questions: int
    accuracy: float | None


class ReviewS(Camel):
    question_id: int
    stem: str
    concept: str
    times_wrong: int
    last_answered_days: int | None
    due_in_hours: int


class Totals(Camel):
    answered: int
    answered_this_week: int
    streak_days: int
    avg_seconds_per_question: int | None


class DifficultyS(Camel):
    level: str
    questions: int
    accuracy: float | None


class BucketS(Camel):
    bucket: str
    questions: int


class Snapshot(Camel):
    subjects: list[SubjectS]
    concepts: list[ConceptS]
    misconceptions: list[MisconceptionS]
    questions: list[QuestionS]
    sessions: list[SessionS]
    daily: list[DailyS]
    review: list[ReviewS]
    totals: Totals
    by_difficulty: list[DifficultyS]
    time_buckets: list[BucketS]
    gate_date: str


def build(db: Session, user: User, tz_minutes: int = 0, now: datetime | None = None) -> Snapshot:
    now = now or datetime.now(UTC)
    tz = timedelta(minutes=tz_minutes)

    def local_day(ts: datetime) -> date:
        return (ts + tz).date()

    today = local_day(now)

    def days_ago(ts: datetime | None) -> int | None:
        return None if ts is None else (today - local_day(ts)).days

    # ---------------------------------------------------------------- content
    subjects = db.scalars(select(Subject).order_by(Subject.id)).all()
    code_of = {s.id: s.code for s in subjects}
    concepts = db.scalars(select(Concept).order_by(Concept.subject_id, Concept.id)).all()
    slug_of = {c.id: c.slug for c in concepts}
    prereqs: dict[int, list[str]] = defaultdict(list)
    for cid, pid in db.execute(select(ConceptPrereq.concept_id, ConceptPrereq.prereq_id)):
        prereqs[cid].append(slug_of[pid])

    qc = db.execute(
        select(QuestionConcept.question_id, QuestionConcept.concept_id, QuestionConcept.is_primary)
    ).all()
    q_primary: dict[int, int] = {}
    q_concepts: dict[int, list[int]] = defaultdict(list)
    for qid, cid, _primary in sorted(qc, key=lambda r: (not r[2], r[1])):
        q_concepts[qid].append(cid)
        q_primary.setdefault(qid, cid)  # primary rows sort first
    concept_subject = {c.id: code_of[c.subject_id] for c in concepts}

    questions = db.scalars(
        select(Question).where(Question.status == "approved").order_by(Question.id)
    ).all()
    qtype = dict(db.execute(select(Question.id, Question.qtype)).all())
    qdiff = dict(db.execute(select(Question.id, Question.difficulty)).all())

    # ---------------------------------------------------------------- attempts
    attempts = db.scalars(
        select(Attempt).where(Attempt.user_id == user.id).order_by(Attempt.answered_at, Attempt.id)
    ).all()

    params: dict = {}

    def bkt_for(cid: int, kind: str):
        if (cid, kind) not in params:
            params[(cid, kind)] = _bkt(db, cid, kind)
        return params[(cid, kind)]

    # replay BKT to get end-of-day mastery per concept
    p: dict[int, float] = {}
    history: dict[int, dict[date, float]] = defaultdict(dict)
    per_concept = defaultdict(lambda: [0, 0])  # attempts, correct
    last_seen: dict[int, datetime] = {}
    for a in attempts:
        for cid in q_concepts.get(a.question_id, []):
            bkt = bkt_for(cid, qtype.get(a.question_id, "MCQ"))
            p[cid] = bkt.update(p.get(cid, bkt.p_init), a.is_correct)
            history[cid][local_day(a.answered_at)] = p[cid]
            per_concept[cid][0] += 1
            per_concept[cid][1] += int(a.is_correct)
            last_seen[cid] = a.answered_at

    cached = dict(
        db.execute(
            select(Mastery.concept_id, Mastery.p_mastery).where(Mastery.user_id == user.id)
        ).all()
    )
    week = [today - timedelta(days=d) for d in range(6, -1, -1)]

    def trend(cid: int) -> list[float]:
        if cid not in history:
            return []
        days = sorted(history[cid])
        value = bkt_for(cid, "MCQ").p_init
        out = []
        for d in week:
            for hd in days:
                if hd <= d:
                    value = history[cid][hd]
            out.append(round(value, 4))
        return out

    concept_rows = [
        ConceptS(
            slug=c.slug,
            name=c.name,
            subject=code_of[c.subject_id],
            description=c.description or "",
            prereqs=sorted(prereqs[c.id]),
            mastery=cached.get(c.id, p.get(c.id)),
            attempts=per_concept[c.id][0],
            accuracy=(per_concept[c.id][1] / per_concept[c.id][0])
            if per_concept[c.id][0]
            else None,
            last_practised_days=days_ago(last_seen.get(c.id)),
            trend=trend(c.id),
        )
        for c in concepts
    ]

    # ---------------------------------------------------------------- misconceptions
    option_mis = dict(
        db.execute(
            select(Option.id, Option.misconception_id).where(Option.misconception_id.is_not(None))
        ).all()
    )
    option_by_label = {
        (qid, label): mid
        for qid, label, mid in db.execute(
            select(Option.question_id, Option.label, Option.misconception_id).where(
                Option.misconception_id.is_not(None)
            )
        )
    }
    hits: Counter[int] = Counter()
    mis_last: dict[int, datetime] = {}
    for a in attempts:
        if a.is_correct:
            continue
        mids = set()
        if a.chosen_option_id in option_mis:
            mids.add(option_mis[a.chosen_option_id])
        for label in (a.chosen_labels or "").split(","):
            if (a.question_id, label) in option_by_label:
                mids.add(option_by_label[(a.question_id, label)])
        for mid in mids:
            hits[mid] += 1
            mis_last[mid] = a.answered_at
    misconceptions = [
        MisconceptionS(
            id=m.id,
            slug=m.slug,
            title=m.title,
            explanation=m.explanation,
            example=m.example,
            concept=slug_of[m.concept_id],
            hits=hits[m.id],
            last_seen_days=days_ago(mis_last.get(m.id)),
        )
        for m in db.scalars(select(Misconception).order_by(Misconception.id))
    ]

    # ---------------------------------------------------------------- sessions and days
    by_session: dict[int, list[Attempt]] = defaultdict(list)
    for a in attempts:
        if a.session_id is not None:
            by_session[a.session_id].append(a)
    session_rows = []
    if by_session:
        sessions = db.scalars(
            select(PracticeSession)
            .where(PracticeSession.id.in_(by_session))
            .order_by(PracticeSession.started_at.desc())
            .limit(20)
        ).all()
        for s in sessions:
            items = by_session[s.id]
            first_concept = q_primary.get(items[0].question_id)
            end = max(a.answered_at for a in items)
            session_rows.append(
                SessionS(
                    id=s.id,
                    date=local_day(s.started_at).isoformat(),
                    subject=code_of.get(s.subject_id) or concept_subject.get(first_concept, ""),
                    mode=MODE_LABEL.get(s.mode or "", "Adaptive"),
                    title=s.title or "Practice session",
                    questions=len(items),
                    correct=sum(a.is_correct for a in items),
                    minutes=max(1, round((end - s.started_at).total_seconds() / 60)),
                    mastery_delta=round(
                        sum((a.mastery_after or 0) - (a.mastery_before or 0) for a in items), 4
                    ),
                )
            )

    per_day = defaultdict(lambda: [0, 0])
    for a in attempts:
        d = per_day[local_day(a.answered_at)]
        d[0] += 1
        d[1] += int(a.is_correct)
    daily = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        n, c = per_day.get(d, (0, 0))
        daily.append(DailyS(date=d.isoformat(), questions=n, accuracy=c / n if n else None))

    streak, d = 0, today
    if d not in per_day:
        d -= timedelta(days=1)  # today not practised yet: the streak can still continue
    while d in per_day:
        streak += 1
        d -= timedelta(days=1)

    times = [a.time_taken_ms for a in attempts if a.time_taken_ms is not None]
    totals = Totals(
        answered=len(attempts),
        answered_this_week=sum(1 for a in attempts if (today - local_day(a.answered_at)).days < 7),
        streak_days=streak,
        avg_seconds_per_question=round(sum(times) / len(times) / 1000) if times else None,
    )

    # ---------------------------------------------------------------- breakdowns
    diff = defaultdict(lambda: [0, 0])
    for a in attempts:
        level = qdiff.get(a.question_id)
        if level:
            diff[level][0] += 1
            diff[level][1] += int(a.is_correct)
    by_difficulty = [
        DifficultyS(
            level=f"Level {lv}",
            questions=diff[lv][0],
            accuracy=diff[lv][1] / diff[lv][0] if diff[lv][0] else None,
        )
        for lv in range(1, 6)
    ]
    buckets = Counter()
    for ms in times:
        sec = ms / 1000
        label = next(lbl for lbl, upper in TIME_BUCKETS if upper is None or sec < upper)
        buckets[label] += 1
    time_buckets = [BucketS(bucket=lbl, questions=buckets[lbl]) for lbl, _ in TIME_BUCKETS]

    # ---------------------------------------------------------------- review queue
    wrong = Counter(a.question_id for a in attempts if not a.is_correct)
    last_answer = {a.question_id: a.answered_at for a in attempts}
    stems = dict(db.execute(select(Question.id, Question.stem_md)).all())
    review = [
        ReviewS(
            question_id=r.question_id,
            stem=plain_preview(stems[r.question_id]),
            concept=slug_of.get(q_primary.get(r.question_id), ""),
            times_wrong=wrong[r.question_id],
            last_answered_days=days_ago(last_answer.get(r.question_id)),
            due_in_hours=round((r.due_at - now).total_seconds() / 3600),
        )
        for r in db.scalars(
            select(ReviewItem).where(ReviewItem.user_id == user.id).order_by(ReviewItem.due_at)
        )
    ]

    return Snapshot(
        subjects=[SubjectS(code=s.code, name=s.name, short=s.code) for s in subjects],
        concepts=concept_rows,
        misconceptions=misconceptions,
        questions=[
            QuestionS(
                id=q.id,
                subject=concept_subject.get(q_primary.get(q.id), ""),
                concept=slug_of.get(q_primary.get(q.id), ""),
                also_tests=[
                    slug_of[c] for c in q_concepts.get(q.id, []) if c != q_primary.get(q.id)
                ],
                difficulty=q.difficulty,
                source=q.source,
                stem=plain_preview(q.stem_md, 220),
            )
            for q in questions
        ],
        sessions=session_rows,
        daily=daily,
        review=review,
        totals=totals,
        by_difficulty=by_difficulty,
        time_buckets=time_buckets,
        gate_date=get_settings().gate_date,
    )
