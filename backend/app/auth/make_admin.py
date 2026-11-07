"""Promote an existing account to admin.

Usage (from backend/, after signing up in the app):
    python -m app.auth.make_admin you@example.com
"""

import sys

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import User


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == argv[0].lower()))
        if user is None:
            print(f"error: no account with email {argv[0]} — sign up in the app first")
            return 1
        user.role = "admin"
        db.commit()
        print(f"{user.email} is now an admin. Log out and back in to get an admin token.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
