from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ScreenIn(BaseModel):
    """What the student is looking at. Only ids are trusted; everything else is re-read."""

    label: str = Field(default="", max_length=120)
    question_id: int | None = None
    answered: bool = False
    concept: str | None = Field(default=None, max_length=120)


class ChatIn(BaseModel):
    conversation_id: int | None = None
    message: str = Field(min_length=1, max_length=2000)
    screen: ScreenIn = Field(default_factory=ScreenIn)


class MessageOut(BaseModel):
    id: int
    role: Literal["user", "coach"]
    text: str
    card: dict | None = None
    source: str | None = None  # 'ai' | 'basic'
    created_at: datetime


class ChatOut(BaseModel):
    conversation_id: int
    title: str
    message: MessageOut


class ConversationSummary(BaseModel):
    id: int
    title: str
    updated_at: datetime


class ConversationOut(ConversationSummary):
    messages: list[MessageOut]


class CoachStatus(BaseModel):
    ai: bool  # True when an LLM key is configured
    model: str | None
