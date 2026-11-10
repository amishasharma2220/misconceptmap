import json

import pytest
from sqlalchemy import select

from app.coach import service
from app.coach.context import build
from app.coach.schemas import ScreenIn
from app.models import CoachMessage, Question, User
from tests.conftest import FakeLLM


def reply(text="Here you go.", show="none", concept=None, hint_steps=None):
    return json.dumps(
        {"reply": text, "show": show, "concept": concept, "hint_steps": hint_steps or []}
    )


def chat(client, headers, message, **kw):
    r = client.post("/coach/chat", json={"message": message, **kw}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def answer(client, db, headers, qid, correct: bool):
    q = db.get(Question, qid)
    label = next(o.label for o in q.options if o.is_correct == correct)
    s = client.post(
        "/sessions", json={"mode": "questions", "questions": [qid]}, headers=headers
    ).json()
    r = client.post(
        f"/sessions/{s['id']}/answer", json={"question_id": qid, "chosen": [label]}, headers=headers
    )
    assert r.status_code == 200
    return label


# ------------------------------------------------------------------ basic coach (no key)


def test_status_reports_whether_ai_is_on(client, student_headers, llm_holder):
    assert client.get("/coach/status", headers=student_headers).json() == {
        "ai": False,
        "model": None,
    }
    llm_holder["client"] = FakeLLM()
    assert client.get("/coach/status", headers=student_headers).json()["ai"] is True


def test_basic_coach_recommends_and_saves_the_conversation(client, student_headers, bank):
    out = chat(client, student_headers, "What should I practise today?")
    msg = out["message"]
    assert msg["source"] == "basic" and msg["card"]["kind"] == "recommend"
    items = msg["card"]["items"]
    assert 1 <= len(items) <= 4 and all(i["questionId"] in bank.values() for i in items)
    assert all(i["reason"].startswith("New concept") for i in items)

    convs = client.get("/coach/conversations", headers=student_headers).json()
    assert convs[0]["id"] == out["conversation_id"]
    assert convs[0]["title"] == "What should I practise today?"
    full = client.get(f"/coach/conversations/{out['conversation_id']}", headers=student_headers)
    assert [m["role"] for m in full.json()["messages"]] == ["user", "coach"]


def test_recommendations_put_due_reviews_and_weak_concepts_first(client, db, student_headers, bank):
    answer(client, db, student_headers, bank["dsa-stk-001"], correct=False)
    msg = chat(client, student_headers, "recommend questions")["message"]
    first = msg["card"]["items"][0]
    # the review item is due tomorrow, so the weak concept's unseen question comes first
    assert "Stacks and queues" in first["reason"] or first["reason"].startswith("New concept")
    assert all(i["questionId"] != bank["dsa-stk-001"] for i in msg["card"]["items"])


def test_basic_plan_has_seven_days(client, student_headers, bank):
    card = chat(client, student_headers, "Make me a plan for this week")["message"]["card"]
    assert card["kind"] == "plan" and len(card["days"]) == 7
    assert card["days"][0]["day"] == "Today" and card["daysToGate"] >= 0
    assert all(d["concepts"] for d in card["days"])


def test_basic_mistake_uses_the_real_attempt(client, db, student_headers, bank):
    qid = bank["dsa-asym-001"]
    picked = answer(client, db, student_headers, qid, correct=False)
    screen = {"label": "Practice", "question_id": qid, "answered": True}
    msg = chat(client, student_headers, "Why was my answer wrong?", screen=screen)["message"]
    assert f"You picked {picked}" in msg["text"]
    card = msg["card"]
    assert card["kind"] == "mistake" and not card["hintOnly"]
    assert card["misconceptionTitle"]  # option A is tagged with a misconception
    assert any("4^n" in s for s in card["steps"])  # the official explanation


def test_basic_hint_never_includes_the_answer(client, student_headers, bank):
    qid = bank["dsa-asym-001"]
    screen = {"label": "Practice", "question_id": qid, "answered": False}
    msg = chat(client, student_headers, "Give me a hint", screen=screen)["message"]
    assert msg["card"]["hintOnly"] is True
    text = msg["text"] + " ".join(msg["card"]["steps"])
    assert "4^n" not in text and "answer is" not in text.lower()


def test_basic_concept_overview(client, student_headers, bank):
    msg = chat(client, student_headers, "Explain the master theorem simply")["message"]
    assert msg["card"]["kind"] == "concept" and msg["card"]["concept"] == "master-theorem"
    assert "Builds on: Recurrence relations" in msg["card"]["markdown"]


# ------------------------------------------------------------------ AI coach


def test_ai_reply_is_grounded_and_cards_come_from_the_server(
    client, db, student_headers, bank, llm_holder
):
    answer(client, db, student_headers, bank["dsa-stk-001"], correct=False)
    fake = FakeLLM(reply("Start with these two.", show="recommend"))
    llm_holder["client"] = fake
    msg = chat(client, student_headers, "What should I do next?")["message"]
    assert msg["source"] == "ai" and msg["text"] == "Start with these two."
    assert msg["card"]["kind"] == "recommend"
    assert all(i["questionId"] in bank.values() for i in msg["card"]["items"])

    prompt = fake.prompts[0]
    assert '"slug": "stacks-queues"' in prompt and '"mastery": 0.18' in prompt
    assert "Reading postfix left to right as if it were infix" in prompt  # misconception hit
    stored = db.scalar(select(CoachMessage).where(CoachMessage.role == "coach"))
    assert stored.model == "fake-llm"


def test_answer_is_withheld_from_the_model_before_submitting(
    client, student_headers, bank, llm_holder
):
    qid = bank["dsa-asym-001"]
    fake = FakeLLM(reply("Compare the bases.", show="hint", hint_steps=["Rewrite $2^{2n}$."]))
    llm_holder["client"] = fake
    screen = {"label": "Practice", "question_id": qid, "answered": True}  # a false claim
    msg = chat(client, student_headers, "help", screen=screen)["message"]
    prompt = fake.prompts[0]
    assert '"status": "not answered yet"' in prompt
    assert "correct_option" not in prompt and "official_explanation" not in prompt
    assert "unbounded, so" not in prompt  # text from the official explanation
    assert msg["card"] == {
        "kind": "mistake",
        "hintOnly": True,
        "concept": "Asymptotic notation (O, Ω, Θ)",
        "steps": ["Rewrite $2^{2n}$."],
    }


def test_a_leaked_answer_is_retried_then_replaced(client, student_headers, bank, llm_holder):
    qid = bank["dsa-asym-001"]  # correct option is B
    screen = {"label": "Practice", "question_id": qid, "answered": False}

    fake = FakeLLM(reply("The answer is B."), reply("Think about what $2^{2n}$ equals."))
    llm_holder["client"] = fake
    msg = chat(client, student_headers, "just tell me", screen=screen)["message"]
    assert msg["text"] == "Think about what $2^{2n}$ equals." and msg["source"] == "ai"
    assert "revealed the answer" in fake.prompts[1]

    llm_holder["client"] = FakeLLM(reply("Option B is correct."), reply("Pick B."))
    msg = chat(client, student_headers, "just tell me", screen=screen)["message"]
    assert msg["source"] == "basic" and "B" not in msg["text"].replace("Basic", "")


@pytest.mark.parametrize(
    "text, leaks",
    [
        ("The correct answer is B.", True),
        ("I'd go with B here.", True),
        ("Option B is the right one", True),
        ("Look at option B and option D carefully.", False),
        ("A constant multiplying the exponent changes the base.", False),
    ],
)
def test_leak_detector(db, student_headers, bank, text, leaks):
    user = db.scalar(select(User).where(User.email == "student@example.com"))
    ctx = build(db, user, ScreenIn(question_id=bank["dsa-asym-001"]))
    assert service.leaks_answer(text, ctx) is leaks


def test_after_answering_the_model_gets_the_explanation(
    client, db, student_headers, bank, llm_holder
):
    qid = bank["dsa-asym-001"]
    answer(client, db, student_headers, qid, correct=False)
    fake = FakeLLM(reply("You treated the 2 in the exponent as a constant.", show="mistake"))
    llm_holder["client"] = fake
    screen = {"label": "Practice", "question_id": qid, "answered": True}
    msg = chat(client, student_headers, "why?", screen=screen)["message"]
    assert '"student_was_correct": false' in fake.prompts[0]
    assert '"correct_option": ["B"]' in fake.prompts[0]
    assert msg["card"]["kind"] == "mistake" and msg["card"]["misconceptionTitle"]


def test_unreadable_model_output_falls_back(client, student_headers, bank, llm_holder):
    llm_holder["client"] = FakeLLM("not json", "{also not")
    msg = chat(client, student_headers, "make me a plan")["message"]
    assert msg["source"] == "basic" and msg["card"]["kind"] == "plan"


def test_history_is_sent_with_the_next_message(client, student_headers, bank, llm_holder):
    fake = FakeLLM(reply("First answer."), reply("Second answer."))
    llm_holder["client"] = fake
    conv = chat(client, student_headers, "Hello coach")["conversation_id"]
    chat(client, student_headers, "And then?", conversation_id=conv)
    assert "USER: Hello coach" in fake.prompts[1] and "COACH: First answer." in fake.prompts[1]


# ------------------------------------------------------------------ privacy and limits


def test_conversations_are_private_and_deletable(client, student_headers, admin_headers, bank):
    conv = chat(client, student_headers, "hi")["conversation_id"]
    assert client.get(f"/coach/conversations/{conv}", headers=admin_headers).status_code == 404
    r = client.post(
        "/coach/chat", json={"message": "x", "conversation_id": conv}, headers=admin_headers
    )
    assert r.status_code == 404
    assert client.delete(f"/coach/conversations/{conv}", headers=student_headers).status_code == 204
    assert client.get("/coach/conversations", headers=student_headers).json() == []


def test_hourly_limit(client, student_headers, bank, monkeypatch):
    monkeypatch.setattr(service, "HOURLY_LIMIT", 2)
    chat(client, student_headers, "one")
    chat(client, student_headers, "two")
    r = client.post("/coach/chat", json={"message": "three"}, headers=student_headers)
    assert r.status_code == 429


def test_message_length_is_limited(client, student_headers, bank):
    r = client.post("/coach/chat", json={"message": "x" * 2001}, headers=student_headers)
    assert r.status_code == 422


def test_plan_counts_reviews_on_the_day_they_fall_due(client, db, student_headers, bank):
    answer(client, db, student_headers, bank["dsa-stk-001"], correct=False)  # due in 24 hours
    msg = chat(client, student_headers, "plan my week")["message"]
    days = msg["card"]["days"]
    assert days[0]["reviews"] == 0 and days[1]["reviews"] == 1
    assert "0 reviews due today" in msg["text"]
