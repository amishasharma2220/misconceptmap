"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    REAL,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# ---------------------------------------------------------------- content


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)

    concepts: Mapped[list["Concept"]] = relationship(back_populates="subject")


class Concept(Base):
    __tablename__ = "concepts"
    __table_args__ = (CheckConstraint("difficulty BETWEEN 1 AND 5", name="ck_concept_difficulty"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[int | None] = mapped_column(SmallInteger)

    subject: Mapped[Subject] = relationship(back_populates="concepts")


class ConceptPrereq(Base):
    __tablename__ = "concept_prereqs"
    __table_args__ = (CheckConstraint("concept_id <> prereq_id", name="ck_no_self_prereq"),)
    concept_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )
    prereq_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )


class Misconception(Base):
    __tablename__ = "misconceptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"))
    slug: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    example: Mapped[str | None] = mapped_column(Text)


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint("qtype IN ('MCQ','MSQ','NAT')", name="ck_question_qtype"),
        CheckConstraint("difficulty BETWEEN 1 AND 5", name="ck_question_difficulty"),
        CheckConstraint("status IN ('draft','approved','retired')", name="ck_question_status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    qtype: Mapped[str] = mapped_column(Text)
    stem_md: Mapped[str] = mapped_column(Text)
    explanation_md: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[int | None] = mapped_column(SmallInteger)
    nat_answer_min: Mapped[Decimal | None] = mapped_column(Numeric)
    nat_answer_max: Mapped[Decimal | None] = mapped_column(Numeric)
    status: Mapped[str] = mapped_column(Text, server_default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    options: Mapped[list["Option"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="Option.label"
    )


class QuestionConcept(Base):
    __tablename__ = "question_concepts"
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), primary_key=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="false")


class Option(Base):
    __tablename__ = "options"
    __table_args__ = (UniqueConstraint("question_id", "label", name="uq_option_label"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(1))
    text_md: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    misconception_id: Mapped[int | None] = mapped_column(ForeignKey("misconceptions.id"))

    question: Mapped[Question] = relationship(back_populates="options")


class LLMDraft(Base):
    __tablename__ = "llm_drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    model: Mapped[str | None] = mapped_column(Text)
    draft: Mapped[dict] = mapped_column(JSONB)
    accepted_unchanged: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------- learning


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('student','admin')", name="ck_user_role"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, server_default="student")
    consent_research: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PracticeSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint("mode IN ('adaptive','review','subject','mock')", name="ck_session_mode"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    mode: Mapped[str | None] = mapped_column(Text)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Attempt(Base):
    """Append-only: the audit trail and the ML training set. Never update or delete rows."""

    __tablename__ = "attempts"
    __table_args__ = (Index("ix_attempts_user_time", "user_id", "answered_at"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    chosen_option_id: Mapped[int | None] = mapped_column(ForeignKey("options.id"))
    nat_value: Mapped[Decimal | None] = mapped_column(Numeric)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    time_taken_ms: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[int | None] = mapped_column(SmallInteger)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Mastery(Base):
    """Cache derived from attempts; rebuildable by replaying attempts through BKT."""

    __tablename__ = "mastery"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), primary_key=True)
    p_mastery: Mapped[float] = mapped_column(REAL)
    n_attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewItem(Base):
    __tablename__ = "review_queue"
    __table_args__ = (Index("ix_review_user_due", "user_id", "due_at"),)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), primary_key=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    interval_days: Mapped[float] = mapped_column(REAL)
    ease: Mapped[float] = mapped_column(REAL, server_default="2.5")
    repetitions: Mapped[int] = mapped_column(Integer, server_default="0")


class BKTParams(Base):
    __tablename__ = "bkt_params"
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), primary_key=True)
    p_init: Mapped[float | None] = mapped_column(REAL)
    p_learn: Mapped[float | None] = mapped_column(REAL)
    p_slip: Mapped[float | None] = mapped_column(REAL)
    p_guess: Mapped[float | None] = mapped_column(REAL)
    fitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
