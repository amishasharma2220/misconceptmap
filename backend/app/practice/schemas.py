from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Mode = Literal["adaptive", "review", "concept", "questions"]


class SessionIn(BaseModel):
    mode: Mode = "adaptive"
    subject: str | None = None  # subject code, limits adaptive/review sessions
    concept: str | None = None  # concept slug, required for mode=concept
    questions: list[int] = Field(default_factory=list, max_length=50)  # for mode=questions
    size: int = Field(default=10, ge=1, le=50)

    @model_validator(mode="after")
    def _needs(self):
        if self.mode == "concept" and not self.concept:
            raise ValueError("concept is required for a concept session")
        if self.mode == "questions" and not self.questions:
            raise ValueError("questions is required for a questions session")
        return self


class OptionPublic(BaseModel):
    label: str
    text_md: str


class QuestionPublic(BaseModel):
    """What a student sees before answering: no correct flags, no misconceptions."""

    id: int
    qtype: str
    subject: str
    concept: str  # primary concept slug
    also_tests: list[str]
    source: str | None
    difficulty: int | None
    stem_md: str
    preview: str  # one plain-text line, for tables
    options: list[OptionPublic]


class AnswerIn(BaseModel):
    question_id: int
    chosen: list[str] = Field(default_factory=list, max_length=5)  # option labels
    nat_value: Decimal | None = None
    time_taken_ms: int | None = Field(default=None, ge=0, le=3 * 60 * 60 * 1000)
    confidence: int | None = Field(default=None, ge=1, le=3)


class MisconceptionHit(BaseModel):
    label: str
    id: int
    slug: str
    title: str
    explanation: str
    example: str | None


class MasteryChange(BaseModel):
    concept: str
    before: float
    after: float


class AnswerResult(BaseModel):
    question_id: int
    correct: bool
    chosen: list[str]
    nat_value: Decimal | None
    correct_labels: list[str]
    nat_answer_min: Decimal | None
    nat_answer_max: Decimal | None
    explanation_md: str | None
    misconceptions: list[MisconceptionHit]
    mastery: list[MasteryChange]  # primary concept first
    review_due_at: datetime | None  # None = not (or no longer) in the review queue
    time_taken_ms: int | None


class SessionItemOut(BaseModel):
    position: int
    reason: str | None
    question: QuestionPublic
    result: AnswerResult | None


class SessionOut(BaseModel):
    id: int
    mode: str
    title: str
    size: int
    started_at: datetime
    ended_at: datetime | None
    done: bool  # no more questions will be served
    items: list[SessionItemOut]
