"""Question/misconception business rules, kept out of the routes so they are easy to test."""

import re

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.content.schemas import (
    OptionOut,
    QuestionConceptIO,
    QuestionIn,
    QuestionOut,
)
from app.models import Attempt, Concept, LLMDraft, Misconception, Option, Question, QuestionConcept


class ContentError(ValueError):
    """A rule violation the admin can fix; routes turn it into HTTP 400/409."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def slugify(text: str, max_len: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-") or "misconception"


def unique_misconception_slug(db: Session, base: str) -> str:
    slug, n = base, 2
    while db.scalar(select(exists().where(Misconception.slug == slug))):
        slug = f"{base}-{n}"
        n += 1
    return slug


# ------------------------------------------------------------------ validation


def check_structure(data: QuestionIn) -> None:
    """Rules enforced on every save (drafts included)."""
    labels = [o.label for o in data.options]
    if len(labels) != len(set(labels)):
        raise ContentError("Option labels must be unique")
    for o in data.options:
        if o.is_correct and o.misconception_id is not None:
            raise ContentError(f"Option {o.label} is correct, so it cannot carry a misconception")
    if data.qtype == "NAT" and data.options:
        raise ContentError("NAT questions have no options")
    primaries = [c for c in data.concepts if c.is_primary]
    if len(primaries) > 1:
        raise ContentError("Only one concept can be primary")
    ids = [c.concept_id for c in data.concepts]
    if len(ids) != len(set(ids)):
        raise ContentError("A concept is listed twice")


def check_ready_to_approve(q: QuestionOut) -> None:
    """Extra rules before a question can reach students."""
    problems: list[str] = []
    correct = [o for o in q.options if o.is_correct]
    if q.qtype == "MCQ":
        if len(q.options) < 2:
            problems.append("an MCQ needs at least 2 options")
        if len(correct) != 1:
            problems.append("an MCQ needs exactly 1 correct option")
    elif q.qtype == "MSQ":
        if len(q.options) < 2:
            problems.append("an MSQ needs at least 2 options")
        if not correct:
            problems.append("an MSQ needs at least 1 correct option")
    elif q.qtype == "NAT":
        if q.nat_answer_min is None or q.nat_answer_max is None:
            problems.append("a NAT question needs an answer range")
        elif q.nat_answer_min > q.nat_answer_max:
            problems.append("NAT answer min is greater than max")
    if not any(c.is_primary for c in q.concepts):
        problems.append("pick a primary concept")
    if not (q.explanation_md or "").strip():
        problems.append("add an explanation")
    if problems:
        raise ContentError("Not ready to approve: " + "; ".join(problems))


def _check_references(db: Session, data: QuestionIn) -> None:
    concept_ids = {c.concept_id for c in data.concepts}
    if concept_ids:
        found = set(db.scalars(select(Concept.id).where(Concept.id.in_(concept_ids))))
        if missing := concept_ids - found:
            raise ContentError(f"Unknown concept id(s): {sorted(missing)}")
    mis_ids = {o.misconception_id for o in data.options if o.misconception_id is not None}
    if mis_ids:
        found = set(db.scalars(select(Misconception.id).where(Misconception.id.in_(mis_ids))))
        if missing := mis_ids - found:
            raise ContentError(f"Unknown misconception id(s): {sorted(missing)}")


# ------------------------------------------------------------------ read


def to_out(db: Session, q: Question) -> QuestionOut:
    concepts = db.scalars(select(QuestionConcept).where(QuestionConcept.question_id == q.id)).all()
    has_draft = db.scalar(select(exists().where(LLMDraft.question_id == q.id)))
    return QuestionOut(
        id=q.id,
        qtype=q.qtype,
        stem_md=q.stem_md,
        explanation_md=q.explanation_md,
        source=q.source,
        difficulty=q.difficulty,
        nat_answer_min=q.nat_answer_min,
        nat_answer_max=q.nat_answer_max,
        status=q.status,
        options=[OptionOut.model_validate(o) for o in q.options],
        concepts=[
            QuestionConceptIO(concept_id=c.concept_id, is_primary=c.is_primary)
            for c in sorted(concepts, key=lambda c: (not c.is_primary, c.concept_id))
        ],
        has_draft=bool(has_draft),
    )


# ------------------------------------------------------------------ write


def save_question(db: Session, data: QuestionIn, question: Question | None = None) -> Question:
    """Create or fully replace a question. Status is left unchanged on update."""
    check_structure(data)
    _check_references(db, data)

    if question is None:
        question = Question(status="draft")
        db.add(question)
    for field in (
        "qtype",
        "stem_md",
        "explanation_md",
        "source",
        "difficulty",
        "nat_answer_min",
        "nat_answer_max",
    ):
        setattr(question, field, getattr(data, field))
    db.flush()

    # Options are matched by label so ids stay stable for attempts that point at them.
    existing = {o.label: o for o in question.options}
    wanted = {o.label for o in data.options}
    for label, opt in existing.items():
        if label not in wanted:
            used = db.scalar(select(exists().where(Attempt.chosen_option_id == opt.id)))
            if used:
                raise ContentError(
                    f"Option {label} has been answered by students and cannot be removed", 409
                )
            question.options.remove(opt)
    for o in data.options:
        opt = existing.get(o.label)
        if opt is None:
            opt = Option(label=o.label)
            question.options.append(opt)
        opt.text_md, opt.is_correct, opt.misconception_id = (
            o.text_md,
            o.is_correct,
            None if o.is_correct else o.misconception_id,
        )

    db.query(QuestionConcept).filter(QuestionConcept.question_id == question.id).delete()
    for c in data.concepts:
        db.add(
            QuestionConcept(
                question_id=question.id, concept_id=c.concept_id, is_primary=c.is_primary
            )
        )
    db.flush()
    db.refresh(question)
    return question
