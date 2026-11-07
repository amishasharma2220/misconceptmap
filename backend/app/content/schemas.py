from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

QType = Literal["MCQ", "MSQ", "NAT"]
Status = Literal["draft", "approved", "retired"]
Label = Literal["A", "B", "C", "D", "E"]


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class ConceptOut(BaseModel):
    id: int
    subject_code: str
    slug: str
    name: str
    description: str | None
    difficulty: int | None
    prereqs: list[str]


class MisconceptionIn(BaseModel):
    concept_id: int
    title: str = Field(min_length=3, max_length=200)
    explanation: str = Field(min_length=3)
    example: str | None = None
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=80)


class MisconceptionPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    explanation: str | None = Field(default=None, min_length=3)
    example: str | None = None


class MisconceptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    concept_id: int
    slug: str
    title: str
    explanation: str
    example: str | None


class OptionIn(BaseModel):
    label: Label
    text_md: str = Field(min_length=1)
    is_correct: bool = False
    misconception_id: int | None = None


class OptionOut(OptionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class QuestionConceptIO(BaseModel):
    concept_id: int
    is_primary: bool = False


class QuestionIn(BaseModel):
    qtype: QType = "MCQ"
    stem_md: str = Field(min_length=5)
    explanation_md: str | None = None
    source: str | None = Field(default=None, max_length=120)
    difficulty: int | None = Field(default=None, ge=1, le=5)
    nat_answer_min: Decimal | None = None
    nat_answer_max: Decimal | None = None
    options: list[OptionIn] = Field(default_factory=list, max_length=5)
    concepts: list[QuestionConceptIO] = Field(default_factory=list)


class QuestionOut(BaseModel):
    id: int
    qtype: QType
    stem_md: str
    explanation_md: str | None
    source: str | None
    difficulty: int | None
    nat_answer_min: Decimal | None
    nat_answer_max: Decimal | None
    status: Status
    options: list[OptionOut]
    concepts: list[QuestionConceptIO]
    has_draft: bool


class QuestionSummary(BaseModel):
    id: int
    qtype: QType
    stem_preview: str
    source: str | None
    status: Status
    primary_concept: str | None
    n_tagged_options: int
