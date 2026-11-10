"""Everything the coach knows about the student, read from the database.

The coach never trusts numbers from the browser: mastery, misconceptions, the review queue and
the current question's outcome all come from here. Before a question is answered, its correct
option, explanation and misconception tags are deliberately left out.
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.coach.schemas import ScreenIn
from app.content.router import plain_preview
from app.models import Attempt, Misconception, Question, User
from app.practice import snapshot
from app.practice.service import public_question

WEAK = 0.4


@dataclass
class CurrentQuestion:
    id: int
    concept: str  # slug
    concept_name: str
    stem_md: str
    options: list[tuple[str, str]]  # (label, text)
    answered: bool
    # only filled after the student has answered it
    chosen: list[str] = field(default_factory=list)
    correct: bool | None = None
    correct_labels: list[str] = field(default_factory=list)
    nat_answer: str | None = None
    explanation_md: str | None = None
    misconceptions: list[dict] = field(default_factory=list)  # {label,title,explanation}
    # used only by the leak guard, never sent to the model before answering
    secret_labels: list[str] = field(default_factory=list)
    secret_nat: tuple[str, str] | None = None


@dataclass
class Context:
    snap: snapshot.Snapshot
    name: str
    today: date
    now_local: datetime  # the student's wall-clock time
    attempted: set[int]
    question: CurrentQuestion | None
    concept_names: dict[str, str]

    def concept_name(self, slug: str) -> str:
        return self.concept_names.get(slug, slug)

    @property
    def started(self):
        return [c for c in self.snap.concepts if c.mastery is not None]

    def weakest(self, n: int = 5):
        return sorted(self.started, key=lambda c: c.mastery)[:n]

    def to_prompt(self) -> dict:
        s = self.snap
        due = [r for r in s.review if r.due_in_hours <= 0]
        return {
            "student": self.name,
            "today": self.today.isoformat(),
            "days_to_gate": max(0, (date.fromisoformat(s.gate_date) - self.today).days),
            "totals": s.totals.model_dump(),
            "concepts_started": [
                {
                    "slug": c.slug,
                    "name": c.name,
                    "mastery": round(c.mastery, 2),
                    "attempts": c.attempts,
                    "accuracy": None if c.accuracy is None else round(c.accuracy, 2),
                    "prerequisites": c.prereqs,
                }
                for c in sorted(self.started, key=lambda c: c.mastery)
            ],
            "concepts_not_started": len(s.concepts) - len(self.started),
            "misconceptions_hit": [
                {"title": m.title, "concept": m.concept, "times": m.hits}
                for m in sorted(s.misconceptions, key=lambda m: -m.hits)
                if m.hits
            ][:8],
            "review_due_now": len(due),
            "review_queue": len(s.review),
            "all_concepts": [{"slug": c.slug, "name": c.name} for c in s.concepts],
        }


def build(db: Session, user: User, screen: ScreenIn, tz_minutes: int = 330) -> Context:
    snap = snapshot.build(db, user, tz_minutes)
    names = {c.slug: c.name for c in snap.concepts}
    attempted = set(db.scalars(select(Attempt.question_id).where(Attempt.user_id == user.id)))
    now_local = datetime.now(UTC) + timedelta(minutes=tz_minutes)
    return Context(
        snap=snap,
        name=(user.display_name or "").split(" ")[0] or "there",
        today=now_local.date(),
        now_local=now_local,
        attempted=attempted,
        question=_current_question(db, user, screen, names),
        concept_names=names,
    )


def _current_question(
    db: Session, user: User, screen: ScreenIn, names: dict[str, str]
) -> CurrentQuestion | None:
    if not screen.question_id:
        return None
    q = db.get(Question, screen.question_id)
    if q is None or q.status != "approved":
        return None
    pub = public_question(db, q)
    cq = CurrentQuestion(
        id=q.id,
        concept=pub.concept,
        concept_name=names.get(pub.concept, pub.concept),
        stem_md=q.stem_md,
        options=[(o.label, o.text_md) for o in q.options],
        answered=False,
        secret_labels=sorted(o.label for o in q.options if o.is_correct),
        secret_nat=(str(q.nat_answer_min), str(q.nat_answer_max))
        if q.qtype == "NAT" and q.nat_answer_min is not None
        else None,
    )
    if not screen.answered:
        return cq
    # The browser says it was answered: only believe it if an attempt exists.
    last = db.scalar(
        select(Attempt)
        .where(Attempt.user_id == user.id, Attempt.question_id == q.id)
        .order_by(Attempt.answered_at.desc())
        .limit(1)
    )
    if last is None:
        return cq
    chosen = last.chosen_labels.split(",") if last.chosen_labels else []
    mis = []
    for o in q.options:
        if o.label in chosen and not o.is_correct and o.misconception_id:
            m = db.get(Misconception, o.misconception_id)
            if m:
                mis.append({"label": o.label, "title": m.title, "explanation": m.explanation})
    cq.answered = True
    cq.chosen = chosen or ([str(last.nat_value)] if last.nat_value is not None else [])
    cq.correct = last.is_correct
    cq.correct_labels = cq.secret_labels
    if cq.secret_nat:
        lo, hi = cq.secret_nat
        cq.nat_answer = lo if lo == hi else f"between {lo} and {hi}"
    cq.explanation_md = q.explanation_md
    cq.misconceptions = mis
    return cq


def question_prompt(cq: CurrentQuestion | None) -> dict | None:
    """The current question as the model sees it. No answer before submission."""
    if cq is None:
        return None
    out = {
        "concept": cq.concept_name,
        "stem": cq.stem_md,
        "options": [f"{label}. {text}" for label, text in cq.options],
        "status": "answered" if cq.answered else "not answered yet",
    }
    if cq.answered:
        out |= {
            "student_chose": cq.chosen,
            "student_was_correct": cq.correct,
            "correct_option": cq.correct_labels or None,
            "correct_value": cq.nat_answer,
            "official_explanation": cq.explanation_md,
            "misconception_behind_their_choice": cq.misconceptions or None,
        }
    return out


def preview(md: str) -> str:
    return plain_preview(md, 160)
