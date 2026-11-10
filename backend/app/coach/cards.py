"""Cards shown under a coach reply, built from the student's data (never by the model).

Shapes match frontend/src/coach/types.ts.
"""

from datetime import timedelta

from app.coach.context import WEAK, Context

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def recommendations(ctx: Context, n: int = 4, exclude: int | None = None) -> list[dict]:
    """Due reviews first, then unseen questions on weak concepts and their weak prerequisites,
    then unseen questions on concepts not started yet."""
    s = ctx.snap
    by_id = {q.id: q for q in s.questions}
    picked: list[dict] = []
    used = {exclude} if exclude else set()

    def add(qid: int, reason: str) -> None:
        if qid in used or qid not in by_id or len(picked) >= n:
            return
        q = by_id[qid]
        used.add(qid)
        picked.append(
            {
                "questionId": qid,
                "stem": q.stem,
                "concept": ctx.concept_name(q.concept),
                "reason": reason,
                "difficulty": q.difficulty or 3,
            }
        )

    for r in sorted(s.review, key=lambda r: r.due_in_hours):
        if r.due_in_hours <= 0:
            add(r.question_id, f"Due for review · wrong {r.times_wrong}×")

    unseen = [q for q in s.questions if q.id not in ctx.attempted]
    mastery = {c.slug: c.mastery for c in s.concepts}
    prereqs = {c.slug: c.prereqs for c in s.concepts}
    for c in ctx.weakest(8):
        # a weak prerequisite is the better place to start
        for p in prereqs.get(c.slug, []):
            pm = mastery.get(p)
            if pm is not None and pm < 0.6:
                for q in unseen:
                    if q.concept == p:
                        add(q.id, f"{ctx.concept_name(p)} is a weak prerequisite of {c.name}")
                        break
        for q in unseen:
            if q.concept == c.slug or c.slug in q.also_tests:
                add(q.id, f"Practises {c.name} ({round(c.mastery * 100)}% mastery)")
                break
    for q in sorted(unseen, key=lambda q: (len(prereqs.get(q.concept, [])), q.id)):
        if mastery.get(q.concept) is None:
            add(q.id, f"New concept: {ctx.concept_name(q.concept)}")
    return picked


def recommend_card(ctx: Context, exclude: int | None = None) -> dict | None:
    items = recommendations(ctx, exclude=exclude)
    return {"kind": "recommend", "items": items} if items else None


def plan_card(ctx: Context) -> dict:
    """Seven days: the weakest concepts first (prerequisites before the concepts that need them),
    then concepts not started yet, two per day, plus the reviews falling due that day."""
    s = ctx.snap
    order = [c.slug for c in sorted(ctx.started, key=lambda c: c.mastery) if c.mastery < 0.7]
    started = {c.slug for c in ctx.started}
    with_questions = {q.concept for q in s.questions}
    fresh = [c.slug for c in s.concepts if c.slug not in started and c.slug in with_questions]
    fresh += [c.slug for c in s.concepts if c.slug not in started and c.slug not in with_questions]
    focus = order + fresh or [c.slug for c in s.concepts]
    # reviews by the calendar day they fall due; anything overdue counts for today
    due_on: dict = {}
    for r in s.review:
        day = max(ctx.today, (ctx.now_local + timedelta(hours=r.due_in_hours)).date())
        due_on[day] = due_on.get(day, 0) + 1
    days = []
    for i in range(7):
        d = ctx.today + timedelta(days=i)
        pair = [focus[(2 * i) % len(focus)], focus[(2 * i + 1) % len(focus)]] if focus else []
        days.append(
            {
                "day": "Today" if i == 0 else DAY_NAMES[d.weekday()],
                "concepts": [ctx.concept_name(c) for c in dict.fromkeys(pair)],
                "questions": 20 if d.weekday() == 6 else 12,  # a longer set on Sundays
                "reviews": due_on.get(d, 0),
            }
        )
    days_to_gate = ctx.to_prompt()["days_to_gate"]
    return {"kind": "plan", "days": days, "daysToGate": days_to_gate}


def mistake_card(ctx: Context) -> dict | None:
    cq = ctx.question
    if cq is None or not cq.answered:
        return None
    steps = [m["explanation"] for m in cq.misconceptions]
    if cq.explanation_md:
        steps.append(cq.explanation_md)
    similar = recommendations_for_concept(ctx, cq.concept, exclude=cq.id)
    return {
        "kind": "mistake",
        "hintOnly": False,
        "concept": cq.concept_name,
        "misconceptionTitle": cq.misconceptions[0]["title"] if cq.misconceptions else None,
        "steps": steps,
        "similarQuestionId": similar,
    }


def hint_card(ctx: Context, steps: list[str]) -> dict | None:
    cq = ctx.question
    if cq is None or cq.answered or not steps:
        return None
    return {"kind": "mistake", "hintOnly": True, "concept": cq.concept_name, "steps": steps[:4]}


def concept_card(ctx: Context, slug: str | None, markdown: str) -> dict | None:
    if not slug or slug not in ctx.concept_names:
        return None
    return {"kind": "concept", "concept": slug, "markdown": markdown}


def recommendations_for_concept(ctx: Context, slug: str, exclude: int | None = None) -> int | None:
    for q in ctx.snap.questions:
        if q.id != exclude and (q.concept == slug or slug in q.also_tests):
            if q.id not in ctx.attempted:
                return q.id
    return None


def weak_concepts_text(ctx: Context) -> str:
    weak = [c for c in ctx.weakest(3) if c.mastery < WEAK]
    return ", ".join(f"{c.name} ({round(c.mastery * 100)}%)" for c in weak)
