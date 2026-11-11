"""Small in-memory rate limiter for sign-in and sign-up.

Counts live in this process, which suits a single backend instance. If the API is ever run
as several instances, move these counters to the database or Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class Limiter:
    def __init__(self, limit: int, window_seconds: int, message: str):
        self.limit, self.window, self.message = limit, window_seconds, message
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str, now: float) -> deque[float]:
        q = self._hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            self._hits.pop(key, None)
            q = self._hits[key]
        return q

    def check(self, key: str) -> None:
        """Raise 429 if this key has used up its allowance."""
        now = time.monotonic()
        q = self._recent(key, now)
        if len(q) >= self.limit:
            retry = max(1, int(q[0] + self.window - now))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                self.message,
                headers={"Retry-After": str(retry)},
            )

    def hit(self, key: str) -> None:
        self._recent(key, time.monotonic()).append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        if key is None:
            self._hits.clear()
        else:
            self._hits.pop(key, None)


# 5 wrong passwords for one account from one address, or 20 from anywhere, per 15 minutes.
login_by_address = Limiter(5, 15 * 60, "Too many failed sign-in attempts. Try again in 15 minutes.")
login_by_account = Limiter(
    20, 15 * 60, "Too many failed sign-in attempts. Try again in 15 minutes."
)
# 10 new accounts from one address per hour.
signups = Limiter(10, 60 * 60, "Too many accounts created from this network. Try again later.")


def client_address(request: Request) -> str:
    """The caller's address. Behind a hosting proxy the real one is in X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
