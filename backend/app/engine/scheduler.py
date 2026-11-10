"""Spaced repetition for questions answered wrongly (a simplified SM-2).

Wrong -> due again in 1 day, ease drops.
Right while in the queue -> interval grows by the ease factor; after 3 correct reviews in a
row with a long enough gap the question leaves the queue.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

MIN_EASE = 1.3
GRADUATE_AFTER = 3
GRADUATE_DAYS = 14


@dataclass
class Schedule:
    interval_days: float
    ease: float
    repetitions: int
    due_at: datetime


def after_wrong(now: datetime, current: Schedule | None) -> Schedule:
    ease = max(MIN_EASE, (current.ease if current else 2.5) - 0.2)
    return Schedule(interval_days=1.0, ease=ease, repetitions=0, due_at=now + timedelta(days=1))


def after_right(now: datetime, current: Schedule) -> Schedule | None:
    """Returns the next schedule, or None when the question graduates out of the queue."""
    reps = current.repetitions + 1
    interval = 3.0 if reps == 1 else current.interval_days * current.ease
    if reps >= GRADUATE_AFTER and interval >= GRADUATE_DAYS:
        return None
    return Schedule(
        interval_days=interval,
        ease=current.ease + 0.05,
        repetitions=reps,
        due_at=now + timedelta(days=interval),
    )
