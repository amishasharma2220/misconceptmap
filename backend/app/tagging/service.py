"""Draft misconception tags with an LLM, validate them, and measure how often you accept them.

The LLM never publishes anything: it returns a draft, the admin edits/approves, and on approval
we record whether the draft's tags were accepted unchanged (a metric for the write-up).
"""

import json

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Concept,
    LLMDraft,
    Misconception,
    Question,
    QuestionConcept,
    Subject,
)
from app.tagging.llm import LLMClient, LLMError

# ------------------------------------------------------------------ what the LLM must return


class NewMisconception(BaseModel):
    concept: str
    title: str = Field(min_length=3, max_length=200)
    explanation: str = Field(min_length=3)
    example: str | None = None


class LLMOption(BaseModel):
    label: str
    misconception: str | None = None
    new_misconception: NewMisconception | None = None
    reason: str = ""


class LLMPayload(BaseModel):
    primary_concept: str
    secondary_concepts: list[str] = Field(default_factory=list)
    options: list[LLMOption] = Field(default_factory=list)
    explanation_md: str = ""


# ------------------------------------------------------------------ what the API returns


class ProposedMisconception(BaseModel):
    concept_id: int
    title: str
    explanation: str
    example: str | None = None


class DraftOption(BaseModel):
    label: str
    misconception_id: int | None = None
    new_misconception: ProposedMisconception | None = None
    reason: str = ""


class DraftOut(BaseModel):
    draft_id: int
    model: str
    primary_concept_id: int | None
    secondary_concept_ids: list[int]
    options: list[DraftOption]
    explanation_md: str
    warnings: list[str]


class TaggingError(RuntimeError):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


PROMPT = """You are helping build a GATE Computer Science practice bank.
For the question below, identify which concepts it tests and, for every WRONG option,
the specific misconception a student who picks it most likely holds.

Rules:
- Use only concept slugs from CONCEPTS.
- Prefer an existing misconception slug from MISCONCEPTIONS when one fits.
- Only if none fits, propose a new misconception: a specific wrong belief, stated as what the
  student believes (e.g. "Believes heap sort is stable"), linked to one concept slug.
- If a wrong option looks like a careless/arithmetic slip rather than a belief, set both
  "misconception" and "new_misconception" to null and say so in "reason".
- Correct options get null for both.
- explanation_md: a concise explanation of the correct answer in Markdown ($...$ for math).

Reply with JSON only, exactly this shape:
{{"primary_concept": "slug", "secondary_concepts": ["slug"],
 "options": [{{"label": "A", "misconception": "existing-slug or null",
   "new_misconception": {{"concept": "slug", "title": "...", "explanation": "...",
   "example": "..."}} or null, "reason": "one sentence"}}],
 "explanation_md": "..."}}

CONCEPTS (slug: name):
{concepts}

MISCONCEPTIONS (slug [concept]: title):
{misconceptions}

QUESTION ({qtype}):
{stem}

OPTIONS:
{options}
"""


def build_prompt(db: Session, question: Question, subject: Subject) -> str:
    concepts = db.scalars(
        select(Concept).where(Concept.subject_id == subject.id).order_by(Concept.id)
    ).all()
    concept_ids = [c.id for c in concepts]
    slug_of = {c.id: c.slug for c in concepts}
    mis = db.scalars(select(Misconception).where(Misconception.concept_id.in_(concept_ids))).all()
    options = "\n".join(
        f"{o.label}. {o.text_md}{'   <- correct' if o.is_correct else ''}" for o in question.options
    )
    return PROMPT.format(
        concepts="\n".join(f"{c.slug}: {c.name}" for c in concepts),
        misconceptions="\n".join(f"{m.slug} [{slug_of[m.concept_id]}]: {m.title}" for m in mis)
        or "(none yet)",
        qtype=question.qtype,
        stem=question.stem_md,
        options=options or "(numerical answer, no options)",
    )


def _parse(raw: str) -> LLMPayload:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{") :]
    return LLMPayload.model_validate(json.loads(text))


def draft_tags(db: Session, llm: LLMClient, question: Question, subject: Subject) -> DraftOut:
    prompt = build_prompt(db, question, subject)

    payload, last_error = None, ""
    for _ in range(2):  # one retry on invalid output
        try:
            raw = llm.complete_json(prompt)
        except LLMError as e:
            raise TaggingError(str(e)) from e
        try:
            payload = _parse(raw)
            break
        except (ValueError, ValidationError) as e:
            last_error = str(e)[:200]
            prompt += "\n\nYour previous reply was not valid JSON in the required shape. Try again."
    if payload is None:
        raise TaggingError(f"LLM returned invalid output twice: {last_error}")

    concept_by_slug = {
        c.slug: c.id for c in db.scalars(select(Concept).where(Concept.subject_id == subject.id))
    }
    mis_by_slug = {m.slug: m.id for m in db.scalars(select(Misconception))}
    correct = {o.label for o in question.options if o.is_correct}
    labels = {o.label for o in question.options}
    warnings: list[str] = []

    primary = concept_by_slug.get(payload.primary_concept)
    if primary is None:
        warnings.append(f"ignored unknown primary concept '{payload.primary_concept}'")
    secondary = []
    for s in payload.secondary_concepts:
        cid = concept_by_slug.get(s)
        if cid is None:
            warnings.append(f"ignored unknown concept '{s}'")
        elif cid != primary and cid not in secondary:
            secondary.append(cid)

    options: list[DraftOption] = []
    for o in payload.options:
        if o.label not in labels:
            warnings.append(f"ignored option '{o.label}' that the question does not have")
            continue
        out = DraftOption(label=o.label, reason=o.reason)
        if o.label in correct:
            options.append(out)
            continue
        if o.misconception:
            mid = mis_by_slug.get(o.misconception)
            if mid is None:
                warnings.append(f"option {o.label}: unknown misconception '{o.misconception}'")
            else:
                out.misconception_id = mid
        elif o.new_misconception:
            cid = concept_by_slug.get(o.new_misconception.concept) or primary
            if cid is None:
                warnings.append(f"option {o.label}: new misconception has no valid concept")
            else:
                out.new_misconception = ProposedMisconception(
                    concept_id=cid,
                    title=o.new_misconception.title,
                    explanation=o.new_misconception.explanation,
                    example=o.new_misconception.example,
                )
        options.append(out)

    record = LLMDraft(
        question_id=question.id,
        model=llm.model,
        draft={
            "primary_concept_id": primary,
            "secondary_concept_ids": secondary,
            "options": [o.model_dump() for o in options],
            "explanation_md": payload.explanation_md,
            "warnings": warnings,
        },
    )
    db.add(record)
    db.flush()
    return DraftOut(
        draft_id=record.id,
        model=llm.model,
        primary_concept_id=primary,
        secondary_concept_ids=secondary,
        options=options,
        explanation_md=payload.explanation_md,
        warnings=warnings,
    )


def record_acceptance(db: Session, question: Question) -> bool | None:
    """On approval, compare final tags with the latest draft. Returns the verdict (or None)."""
    draft = db.scalar(
        select(LLMDraft)
        .where(LLMDraft.question_id == question.id)
        .order_by(LLMDraft.id.desc())
        .limit(1)
    )
    if draft is None:
        return None
    d = draft.draft
    final = db.scalars(select(QuestionConcept).where(QuestionConcept.question_id == question.id))
    final = list(final)
    final_primary = next((c.concept_id for c in final if c.is_primary), None)
    final_secondary = {c.concept_id for c in final if not c.is_primary}

    same = final_primary == d.get("primary_concept_id") and final_secondary == set(
        d.get("secondary_concept_ids", [])
    )
    by_label = {o.label: o for o in question.options}
    titles = {
        m.id: m.title
        for m in db.scalars(
            select(Misconception).where(
                Misconception.id.in_(
                    [o.misconception_id for o in question.options if o.misconception_id]
                )
            )
        )
    }
    for o in d.get("options", []):
        opt = by_label.get(o["label"])
        if opt is None or opt.is_correct:
            continue
        if o.get("misconception_id") is not None:
            same &= opt.misconception_id == o["misconception_id"]
        elif o.get("new_misconception"):
            same &= titles.get(opt.misconception_id) == o["new_misconception"]["title"]
        else:
            same &= opt.misconception_id is None
    draft.accepted_unchanged = bool(same)
    return draft.accepted_unchanged
