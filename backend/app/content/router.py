import re
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import exists, func, select

from app.auth.deps import AdminUser, CurrentUser
from app.content.schemas import (
    ConceptOut,
    MisconceptionIn,
    MisconceptionOut,
    MisconceptionPatch,
    QuestionIn,
    QuestionOut,
    QuestionSummary,
    Status,
    SubjectOut,
)
from app.content.service import (
    ContentError,
    check_ready_to_approve,
    save_question,
    slugify,
    to_out,
    unique_misconception_slug,
)
from app.core.db import DbSession
from app.models import (
    Concept,
    ConceptPrereq,
    Misconception,
    Option,
    Question,
    QuestionConcept,
    Subject,
)
from app.tagging.llm import LLM
from app.tagging.service import DraftOut, TaggingError, draft_tags, record_acceptance

router = APIRouter()


def plain_preview(md: str, limit: int = 140) -> str:
    """One line of readable text from Markdown + LaTeX, for list views."""
    text = re.sub(r"\$\$?([^$]*)\$\$?", r"\1", md)  # $x$ / $$x$$ -> x
    text = re.sub(r"[*_`#>]+", "", text)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _http(e: ContentError) -> HTTPException:
    return HTTPException(e.status, str(e))


def _get_question(db, question_id: int) -> Question:
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return q


# ------------------------------------------------------------------ subjects & concepts


@router.get("/subjects", tags=["content"])
def list_subjects(db: DbSession, _: CurrentUser) -> list[SubjectOut]:
    return [
        SubjectOut.model_validate(s) for s in db.scalars(select(Subject).order_by(Subject.code))
    ]


@router.get("/concepts", tags=["content"])
def list_concepts(
    db: DbSession, _: CurrentUser, subject: Annotated[str | None, Query()] = None
) -> list[ConceptOut]:
    stmt = select(Concept, Subject.code).join(Subject).order_by(Concept.id)
    if subject:
        stmt = stmt.where(Subject.code == subject)
    rows = db.execute(stmt).all()
    slug_of = dict(db.execute(select(Concept.id, Concept.slug)).all())
    prereqs: dict[int, list[str]] = {}
    for cp in db.scalars(select(ConceptPrereq)):
        prereqs.setdefault(cp.concept_id, []).append(slug_of[cp.prereq_id])
    return [
        ConceptOut(
            id=c.id,
            subject_code=code,
            slug=c.slug,
            name=c.name,
            description=c.description,
            difficulty=c.difficulty,
            prereqs=sorted(prereqs.get(c.id, [])),
        )
        for c, code in rows
    ]


# ------------------------------------------------------------------ misconceptions


@router.get("/admin/misconceptions", tags=["admin"])
def list_misconceptions(
    db: DbSession,
    _: AdminUser,
    concept_id: int | None = None,
    subject: str | None = None,
) -> list[MisconceptionOut]:
    stmt = select(Misconception).order_by(Misconception.concept_id, Misconception.id)
    if concept_id is not None:
        stmt = stmt.where(Misconception.concept_id == concept_id)
    if subject:
        stmt = stmt.join(Concept).join(Subject).where(Subject.code == subject)
    return [MisconceptionOut.model_validate(m) for m in db.scalars(stmt)]


@router.post("/admin/misconceptions", status_code=201, tags=["admin"])
def create_misconception(body: MisconceptionIn, db: DbSession, _: AdminUser) -> MisconceptionOut:
    if db.get(Concept, body.concept_id) is None:
        raise HTTPException(400, f"Unknown concept id {body.concept_id}")
    if body.slug:
        if db.scalar(select(exists().where(Misconception.slug == body.slug))):
            raise HTTPException(409, f"Slug '{body.slug}' is already used")
        slug = body.slug
    else:
        slug = unique_misconception_slug(db, slugify(body.title))
    m = Misconception(
        concept_id=body.concept_id,
        slug=slug,
        title=body.title,
        explanation=body.explanation,
        example=body.example,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return MisconceptionOut.model_validate(m)


@router.patch("/admin/misconceptions/{misconception_id}", tags=["admin"])
def update_misconception(
    misconception_id: int, body: MisconceptionPatch, db: DbSession, _: AdminUser
) -> MisconceptionOut:
    m = db.get(Misconception, misconception_id)
    if m is None:
        raise HTTPException(404, "Misconception not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return MisconceptionOut.model_validate(m)


@router.delete("/admin/misconceptions/{misconception_id}", status_code=204, tags=["admin"])
def delete_misconception(misconception_id: int, db: DbSession, _: AdminUser) -> None:
    m = db.get(Misconception, misconception_id)
    if m is None:
        raise HTTPException(404, "Misconception not found")
    if db.scalar(select(exists().where(Option.misconception_id == m.id))):
        raise HTTPException(409, "This misconception is tagged on options; untag them first")
    db.delete(m)
    db.commit()


# ------------------------------------------------------------------ questions


@router.get("/admin/questions", tags=["admin"])
def list_questions(
    db: DbSession,
    _: AdminUser,
    status_: Annotated[Status | None, Query(alias="status")] = None,
    subject: str | None = None,
    q: str | None = None,
) -> list[QuestionSummary]:
    stmt = select(Question).order_by(Question.id.desc())
    if status_:
        stmt = stmt.where(Question.status == status_)
    if q:
        stmt = stmt.where(Question.stem_md.ilike(f"%{q}%") | Question.source.ilike(f"%{q}%"))
    if subject:
        stmt = stmt.where(
            exists()
            .where(QuestionConcept.question_id == Question.id)
            .where(QuestionConcept.concept_id == Concept.id)
            .where(Concept.subject_id == Subject.id)
            .where(Subject.code == subject)
        )
    questions = db.scalars(stmt).all()
    ids = [x.id for x in questions]
    primary = dict(
        db.execute(
            select(QuestionConcept.question_id, Concept.name)
            .join(Concept)
            .where(QuestionConcept.question_id.in_(ids), QuestionConcept.is_primary)
        ).all()
    )
    tagged = dict(
        db.execute(
            select(Option.question_id, func.count())
            .where(Option.question_id.in_(ids), Option.misconception_id.is_not(None))
            .group_by(Option.question_id)
        ).all()
    )
    return [
        QuestionSummary(
            id=x.id,
            qtype=x.qtype,
            stem_preview=plain_preview(x.stem_md),
            source=x.source,
            status=x.status,
            primary_concept=primary.get(x.id),
            n_tagged_options=tagged.get(x.id, 0),
        )
        for x in questions
    ]


@router.get("/admin/questions/{question_id}", tags=["admin"])
def get_question(question_id: int, db: DbSession, _: AdminUser) -> QuestionOut:
    return to_out(db, _get_question(db, question_id))


@router.post("/admin/questions", status_code=201, tags=["admin"])
def create_question(body: QuestionIn, db: DbSession, _: AdminUser) -> QuestionOut:
    try:
        q = save_question(db, body)
    except ContentError as e:
        db.rollback()
        raise _http(e) from e
    db.commit()
    return to_out(db, q)


@router.put("/admin/questions/{question_id}", tags=["admin"])
def update_question(question_id: int, body: QuestionIn, db: DbSession, _: AdminUser) -> QuestionOut:
    q = _get_question(db, question_id)
    try:
        save_question(db, body, q)
        if q.status == "approved":
            check_ready_to_approve(to_out(db, q))
    except ContentError as e:
        db.rollback()
        raise _http(e) from e
    db.commit()
    return to_out(db, q)


class ApproveOut(BaseModel):
    question: QuestionOut
    draft_accepted_unchanged: bool | None


@router.post("/admin/questions/{question_id}/approve", tags=["admin"])
def approve_question(question_id: int, db: DbSession, _: AdminUser) -> ApproveOut:
    q = _get_question(db, question_id)
    try:
        check_ready_to_approve(to_out(db, q))
    except ContentError as e:
        raise _http(e) from e
    q.status = "approved"
    verdict = record_acceptance(db, q)
    db.commit()
    return ApproveOut(question=to_out(db, q), draft_accepted_unchanged=verdict)


@router.post("/admin/questions/{question_id}/retire", tags=["admin"])
def retire_question(question_id: int, db: DbSession, _: AdminUser) -> QuestionOut:
    q = _get_question(db, question_id)
    q.status = "retired"
    db.commit()
    return to_out(db, q)


@router.post("/admin/questions/{question_id}/reopen", tags=["admin"])
def reopen_question(question_id: int, db: DbSession, _: AdminUser) -> QuestionOut:
    q = _get_question(db, question_id)
    q.status = "draft"
    db.commit()
    return to_out(db, q)


# ------------------------------------------------------------------ LLM tagging


class DraftIn(BaseModel):
    subject: str


@router.post("/admin/questions/{question_id}/draft-tags", tags=["admin"])
def draft_question_tags(
    question_id: int, body: DraftIn, db: DbSession, _: AdminUser, llm: LLM
) -> DraftOut:
    if llm is None:
        raise HTTPException(
            503, "LLM drafting is off: set LLM_API_KEY in backend/.env and restart the backend"
        )
    q = _get_question(db, question_id)
    subject = db.scalar(select(Subject).where(Subject.code == body.subject))
    if subject is None:
        raise HTTPException(400, f"Unknown subject '{body.subject}'")
    try:
        out = draft_tags(db, llm, q, subject)
    except TaggingError as e:
        db.rollback()
        raise HTTPException(e.status, str(e)) from e
    db.commit()
    return out
