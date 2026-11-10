"""Choose the next question for an adaptive session.

Rule (explainable on purpose):
1. Candidate concepts are those with approved questions not yet served in this session,
   and mastery below MASTERED.
2. Take the weakest candidate.
3. If one of its prerequisites is weaker than READY and also has questions, go down to that
   prerequisite instead (repeat), so the root of the problem is practised first.
4. Within the concept, prefer questions never attempted, then the least recently attempted.

Returns the question and a one-line reason shown to the student.
"""

from dataclasses import dataclass

READY = 0.6
MASTERED = 0.95


@dataclass(frozen=True)
class Candidate:
    question_id: int
    concept_id: int
    last_attempt_ts: float | None  # None = never attempted


def choose(
    mastery: dict[int, float],
    names: dict[int, str],
    prereqs: dict[int, list[int]],
    candidates: list[Candidate],
    p_init: float = 0.2,
) -> tuple[int, str] | None:
    if not candidates:
        return None
    by_concept: dict[int, list[Candidate]] = {}
    for c in candidates:
        by_concept.setdefault(c.concept_id, []).append(c)

    m = lambda cid: mastery.get(cid, p_init)  # noqa: E731
    seen = set(mastery)
    open_concepts = [cid for cid in by_concept if m(cid) < MASTERED] or list(by_concept)
    # weakest first; ties broken by fewest prerequisites (roots before leaves), then id
    target = min(open_concepts, key=lambda cid: (m(cid), len(prereqs.get(cid, [])), cid))

    reason = (
        f"Weakest concept: {names[target]}" if target in seen else f"New concept: {names[target]}"
    )
    # walk down to the weakest prerequisite that has questions
    visited = {target}
    while True:
        weak = [
            p
            for p in prereqs.get(target, [])
            if p in by_concept and m(p) < READY and p not in visited
        ]
        if not weak:
            break
        child = target
        target = min(weak, key=lambda cid: (m(cid), cid))
        visited.add(target)
        reason = f"Weak prerequisite of {names[child]}"

    pool = by_concept[target]
    never = [c for c in pool if c.last_attempt_ts is None]
    pick = (
        min(never, key=lambda c: c.question_id)
        if never
        else min(pool, key=lambda c: (c.last_attempt_ts, c.question_id))
    )
    return pick.question_id, reason
