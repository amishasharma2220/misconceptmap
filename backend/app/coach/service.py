"""The coach: answer a message using the student's own data.

With an LLM key, the model writes the reply and decides which card to show; the card's
contents are always built here from the database. Without a key (or if the model fails),
a basic rule-based coach answers instead, and the reply is labelled as such.
"""

import json
import re
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.coach import cards
from app.coach.context import Context, build, question_prompt
from app.coach.schemas import ChatIn, ChatOut, ConversationOut, ConversationSummary, MessageOut
from app.models import CoachConversation, CoachMessage, User
from app.tagging.llm import LLMClient, LLMError

HOURLY_LIMIT = 40
HISTORY = 8
SHOW = ("recommend", "plan", "mistake", "hint", "concept", "none")


class CoachError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ------------------------------------------------------------------ the model's reply


class ModelReply(BaseModel):
    reply: str = Field(min_length=1, max_length=6000)
    show: str = "none"
    concept: str | None = None
    hint_steps: list[str] = Field(default_factory=list)


PROMPT = """You are the study coach inside MisconceptMap, an app for GATE CS preparation.
The student is talking to you from inside the app. Be warm, direct and brief.

RULES
1. Anything you say about the student (scores, mastery, mistakes, what is due) must come from
   STUDENT DATA. Never invent numbers, questions or history. If the data does not say, say so.
2. If CURRENT QUESTION has status "not answered yet", you may only give a hint: point to the
   idea to use or a first step. Never say or imply which option is correct, never eliminate
   options down to one, and never work the problem to its final value.
3. If the student answered it, explain why their choice was wrong (or right), using the
   misconception and official explanation provided. Do not contradict the official answer.
4. Keep replies under 120 words unless the student asks for a full explanation. Use Markdown;
   write maths in $...$. Do not repeat the contents of the card shown under your reply.
5. Only talk about GATE CS, studying and this app. Politely decline anything else.

CARDS. Choose "show" for the card the app will display under your reply:
- "recommend": the student wants questions to practise. The app will show exactly
  RECOMMENDED QUESTIONS below; refer to them, do not list them again.
- "plan": the student wants a study plan or schedule. The app will show PLAN.
- "mistake": the student asks about the current question after answering it.
- "hint": the student asks for help on the current question before answering. Also fill
  "hint_steps" with 1-3 short hint steps (no answer).
- "concept": you are explaining a concept; set "concept" to its slug from all_concepts.
- "none": anything else.

Return only JSON: {{"reply": "...", "show": "...", "concept": null, "hint_steps": []}}

STUDENT DATA
{data}

CURRENT SCREEN: {screen}
CURRENT QUESTION
{question}

RECOMMENDED QUESTIONS (shown if show = "recommend")
{recommend}

PLAN (shown if show = "plan")
{plan}

CONVERSATION SO FAR
{history}

STUDENT: {message}
"""


def _prompt(ctx: Context, data: ChatIn, history: list[CoachMessage]) -> str:
    rec = cards.recommend_card(ctx, exclude=ctx.question.id if ctx.question else None)
    plan = cards.plan_card(ctx)
    return PROMPT.format(
        data=json.dumps(ctx.to_prompt(), ensure_ascii=False),
        screen=data.screen.label or "unknown",
        question=json.dumps(question_prompt(ctx.question), ensure_ascii=False)
        if ctx.question
        else "none",
        recommend=json.dumps(rec["items"] if rec else [], ensure_ascii=False),
        plan=json.dumps(plan["days"], ensure_ascii=False),
        history="\n".join(f"{m.role.upper()}: {m.text[:800]}" for m in history) or "(new)",
        message=data.message,
    )


# ------------------------------------------------------------------ answer-leak guard


def leaks_answer(text: str, ctx: Context) -> bool:
    cq = ctx.question
    if cq is None or cq.answered:
        return False
    t = text.lower()
    for label in cq.secret_labels:
        lab = label.lower()
        patterns = [
            rf"\b(answer|option|choice)\s*(is|=|:)?\s*\(?\**{lab}\**\)?\s*(is\s+)?(correct|right)",
            rf"\b(correct|right)\s+(answer|option|choice)\s+(is|would be|=|:)\s*\(?\**{lab}\b",
            rf"\b(the\s+)?answer\s+(is|would be)\s*\(?\**{lab}\b",
            rf"\b(go with|pick|choose|select)\s+(option\s+)?\(?\**{lab}\b",
            rf"\boption\s+\(?\**{lab}\**\)?\s+(is|would be)\s+(the\s+)?(correct|right|answer)",
        ]
        if any(re.search(p, t) for p in patterns):
            return True
    if cq.secret_nat:
        lo, hi = cq.secret_nat
        for v in {lo, hi}:
            if re.search(rf"(answer|result|value|=)\D{{0,12}}\b{re.escape(v)}\b", t):
                return True
    return False


# ------------------------------------------------------------------ intents for the basic coach


def basic_intent(message: str, ctx: Context) -> str:
    t = message.lower()
    if re.search(r"\bplan|schedule|this week|timetable|routine\b", t):
        return "plan"
    if ctx.question and re.search(r"hint|why|wrong|mistake|stuck|help|explain (this|my)", t):
        return "mistake" if ctx.question.answered else "hint"
    if re.search(r"practi[sc]e|recommend|what should i|questions?|next|revise|review", t):
        return "recommend"
    if find_concept(t, ctx) or re.search(r"explain|what is|how does", t):
        return "concept"
    return "none"


def find_concept(text: str, ctx: Context) -> str | None:
    t = text.lower()
    best = None
    for c in ctx.snap.concepts:
        name = re.sub(r"\s*\(.*\)$", "", c.name).lower()
        for key in {name, c.slug.replace("-", " ")}:
            if key and key in t and (best is None or len(key) > best[1]):
                best = (c.slug, len(key))
    return best[0] if best else None


def basic_reply(intent: str, message: str, ctx: Context) -> tuple[str, dict | None]:
    cq = ctx.question
    if intent == "recommend":
        card = cards.recommend_card(ctx, exclude=cq.id if cq else None)
        if not card:
            return "There are no approved questions to recommend yet.", None
        weak = cards.weak_concepts_text(ctx)
        lead = f"Your weakest concepts right now: {weak}. " if weak else ""
        return f"{lead}These are picked from your answers and review queue.", card
    if intent == "plan":
        card = cards.plan_card(ctx)
        today = card["days"][0]["reviews"]
        return (
            "A week built from your weakest concepts, with prerequisites first. "
            f"{today} review{'s' if today != 1 else ''} due today.",
            card,
        )
    if intent == "mistake" and cq and cq.answered:
        if cq.correct:
            return (
                "You got this one right. Here is the reasoning, so it sticks.",
                cards.mistake_card(ctx),
            )
        picked = ", ".join(cq.chosen) or "that answer"
        return (
            f"You picked {picked}. Here is the belief behind it and the fix.",
            cards.mistake_card(ctx),
        )
    if intent == "hint" and cq and not cq.answered:
        concept = next((c for c in ctx.snap.concepts if c.slug == cq.concept), None)
        steps = [f"This question tests **{cq.concept_name}**."]
        if concept and concept.description:
            steps.append(concept.description)
        if concept and concept.prereqs:
            steps.append(
                "It builds on " + ", ".join(ctx.concept_name(p) for p in concept.prereqs) + "."
            )
        steps.append("Check each option against that idea and rule out the ones that break it.")
        return "A nudge, not the answer:", cards.hint_card(ctx, steps)
    if intent == "concept":
        slug = find_concept(message, ctx) or (cq.concept if cq else None)
        c = next((c for c in ctx.snap.concepts if c.slug == slug), None)
        if c is None:
            return (
                "Tell me which concept you mean, for example *master theorem* or *hashing*.",
                None,
            )
        mis = [m.title for m in ctx.snap.misconceptions if m.concept == c.slug]
        md = f"**{c.name}**\n\n{c.description or ''}"
        if c.prereqs:
            md += "\n\nBuilds on: " + ", ".join(ctx.concept_name(p) for p in c.prereqs)
        if mis:
            md += "\n\nCommon misconceptions:\n" + "\n".join(f"- {t}" for t in mis[:4])
        mastery = "not started" if c.mastery is None else f"{round(c.mastery * 100)}% mastery"
        return f"Here is an overview. You are at {mastery} on it.", cards.concept_card(
            ctx, c.slug, md
        )
    return (
        "I can recommend questions from your weak spots, make a week's plan, give a hint on the "
        "question in front of you, explain why an answer was wrong, or outline a concept.",
        None,
    )


# ------------------------------------------------------------------ one turn


def _ai_reply(
    llm: LLMClient, ctx: Context, data: ChatIn, history: list[CoachMessage]
) -> tuple[str, dict | None]:
    prompt = _prompt(ctx, data, history)
    for attempt in range(2):
        raw = llm.complete_json(prompt)
        try:
            out = ModelReply.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as e:
            if attempt == 1:
                raise LLMError("The model returned an unreadable reply") from e
            continue
        if leaks_answer(out.reply + " " + " ".join(out.hint_steps), ctx):
            if attempt == 0:
                prompt += (
                    "\n\nYour previous reply revealed the answer. The question is NOT answered "
                    "yet: give only a hint, and do not name or imply the correct option."
                )
                continue
            raise LLMError("The model kept revealing the answer")
        show = out.show if out.show in SHOW else "none"
        cq = ctx.question
        card = None
        if show == "recommend":
            card = cards.recommend_card(ctx, exclude=cq.id if cq else None)
        elif show == "plan":
            card = cards.plan_card(ctx)
        elif show == "mistake":
            card = cards.mistake_card(ctx)
        elif show == "hint":
            card = cards.hint_card(ctx, out.hint_steps)
        elif show == "concept":
            slug = (
                out.concept if out.concept in ctx.concept_names else find_concept(data.message, ctx)
            )
            c = next((c for c in ctx.snap.concepts if c.slug == slug), None)
            if c is not None:
                card = cards.concept_card(ctx, c.slug, f"**{c.name}**\n\n{c.description or ''}")
        return out.reply.strip(), card
    raise LLMError("No reply")


def chat(db: Session, user: User, data: ChatIn, llm: LLMClient | None, tz: int = 330) -> ChatOut:
    now = datetime.now(UTC)
    recent = db.scalar(
        select(func.count())
        .select_from(CoachMessage)
        .join(CoachConversation, CoachConversation.id == CoachMessage.conversation_id)
        .where(
            CoachConversation.user_id == user.id,
            CoachMessage.role == "user",
            CoachMessage.created_at > now - timedelta(hours=1),
        )
    )
    if recent >= HOURLY_LIMIT:
        raise CoachError(
            "You have sent a lot of messages this hour. Try again a little later.", 429
        )

    if data.conversation_id:
        conv = db.get(CoachConversation, data.conversation_id)
        if conv is None or conv.user_id != user.id:
            raise CoachError("Conversation not found", 404)
    else:
        title = " ".join(data.message.split())
        conv = CoachConversation(
            user_id=user.id, title=title[:60] + ("…" if len(title) > 60 else "")
        )
        db.add(conv)
        db.flush()

    history = list(
        db.scalars(
            select(CoachMessage)
            .where(CoachMessage.conversation_id == conv.id)
            .order_by(CoachMessage.id.desc())
            .limit(HISTORY)
        )
    )[::-1]

    ctx = build(db, user, data.screen, tz)
    screen = data.screen.model_dump()
    db.add(CoachMessage(conversation_id=conv.id, role="user", text=data.message, screen=screen))

    source, model = "basic", None
    text, card = None, None
    if llm is not None:
        try:
            text, card = _ai_reply(llm, ctx, data, history)
            source, model = "ai", llm.model
        except LLMError:
            text = None
    if text is None:
        text, card = basic_reply(basic_intent(data.message, ctx), data.message, ctx)

    reply = CoachMessage(
        conversation_id=conv.id, role="coach", text=text, card=card, source=source, model=model
    )
    db.add(reply)
    conv.updated_at = now
    db.flush()
    return ChatOut(conversation_id=conv.id, title=conv.title, message=_out(reply))


def _out(m: CoachMessage) -> MessageOut:
    return MessageOut(
        id=m.id,
        role=m.role,
        text=m.text,
        card=m.card,
        source=m.source,
        created_at=m.created_at or datetime.now(UTC),
    )


def conversations(db: Session, user: User) -> list[ConversationSummary]:
    rows = db.scalars(
        select(CoachConversation)
        .where(CoachConversation.user_id == user.id)
        .order_by(CoachConversation.updated_at.desc())
        .limit(50)
    )
    return [ConversationSummary(id=c.id, title=c.title, updated_at=c.updated_at) for c in rows]


def conversation(db: Session, user: User, conv_id: int) -> ConversationOut:
    conv = db.get(CoachConversation, conv_id)
    if conv is None or conv.user_id != user.id:
        raise CoachError("Conversation not found", 404)
    msgs = db.scalars(
        select(CoachMessage)
        .where(CoachMessage.conversation_id == conv.id)
        .order_by(CoachMessage.id)
    )
    return ConversationOut(
        id=conv.id, title=conv.title, updated_at=conv.updated_at, messages=[_out(m) for m in msgs]
    )


def delete_conversation(db: Session, user: User, conv_id: int) -> None:
    conv = db.get(CoachConversation, conv_id)
    if conv is None or conv.user_id != user.id:
        raise CoachError("Conversation not found", 404)
    db.delete(conv)
    db.flush()
